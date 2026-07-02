import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolDefinition } from "../openai-client";
import {
  buildDaysDisplayMessage,
  buildSlotsDisplayMessage,
  findAvailableDays,
  findAvailablePeriodsForDay,
  findSlotsForDay,
  formatPeriodsLabel,
  formatSlotPeriodLabel,
  normalizeSlotPeriod,
} from "@/lib/appointment-conflicts";
import {
  buildOfferedStateFromSlotsTool,
  isActiveBookingState,
} from "@/lib/operational-agents/booking-executor";
import {
  cancelAppointmentViaAssistant,
  confirmAppointmentViaAssistant,
  createAppointmentViaAssistant,
  listPatientAppointmentsViaAssistant,
  rescheduleAppointmentViaAssistant,
} from "../services/appointments";
import {
  linkConversationToPatient,
  lookupPatientByPhone,
  registerPatientViaAssistant,
} from "../services/patients";
import { minimizePatientForAiToolResult } from "../minimize-patient-for-ai";
import {
  getProcedureInfo,
  listPriceOptionsForClinic,
  listServicesForClinic,
  resolveServicePriceForClinic,
} from "../services/pricing";
import { applyRoutingOnNewConversation } from "@/lib/whatsapp-routing";
import type { AiConversationState } from "../types";
import { patchBookingStepFromTool } from "../booking-flow";
import { formatAppointmentConfirmationMessage } from "../services/appointments";

export const ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "lookup_patient_by_phone",
      description: "Busca paciente cadastrado pelo telefone da conversa.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "register_patient",
      description: "Cadastra novo paciente com nome e telefone.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          email: { type: "string" },
        },
        required: ["full_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_doctors",
      description: "Lista médicos da clínica com especialidade. Use antes de agendar ou informar preço por profissional.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_procedures",
      description:
        "Lista procedimentos da clínica, opcionalmente filtrados por médico. Retorna nome e duração para apresentar ao paciente.",
      parameters: {
        type: "object",
        properties: {
          doctor_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_available_slots",
      description:
        "Busca horários disponíveis para agendamento. Sem date: retorna dias disponíveis. Com date: retorna horários do dia (opcionalmente filtrados por turno manhã/tarde).",
      parameters: {
        type: "object",
        properties: {
          doctor_id: { type: "string" },
          procedure_id: { type: "string" },
          days_ahead: { type: "number", description: "Quantos dias à frente buscar (padrão 14)" },
          date: { type: "string", description: "Data escolhida pelo paciente no formato YYYY-MM-DD" },
          period: {
            type: "string",
            enum: ["manha", "tarde"],
            description: "Turno preferido: manhã ou tarde",
          },
          skip_days: {
            type: "number",
            description: "Pular N dias disponíveis (quando paciente pede outros dias)",
          },
        },
        required: ["doctor_id", "procedure_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Cria agendamento para paciente cadastrado.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { type: "string" },
          doctor_id: { type: "string" },
          procedure_id: { type: "string" },
          scheduled_at: { type: "string", description: "ISO 8601" },
          dimension_value_ids: { type: "array", items: { type: "string" } },
        },
        required: ["patient_id", "doctor_id", "procedure_id", "scheduled_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_procedure_info",
      description: "Detalhes e recomendações de um procedimento.",
      parameters: {
        type: "object",
        properties: { procedure_id: { type: "string" } },
        required: ["procedure_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_service_price",
      description:
        "Consulta preço exato de serviço/procedimento. Se needsDimensions=true, use dimension_value_ids das opções retornadas.",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string" },
          doctor_id: { type: "string" },
          procedure_id: { type: "string" },
          dimension_value_ids: { type: "array", items: { type: "string" } },
        },
        required: ["doctor_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_price_options",
      description:
        "Lista opções de preço (convênio, turno, etc.) e faixa de valores para um procedimento ou serviço. Use quando o paciente perguntar quanto custa.",
      parameters: {
        type: "object",
        properties: {
          procedure_id: { type: "string" },
          service_id: { type: "string" },
          doctor_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_services",
      description:
        "Lista serviços da clínica com categoria, procedimentos vinculados e faixa de preço. Use quando o paciente não souber o nome do procedimento.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_patient_appointments",
      description:
        "Lista consultas futuras do paciente desta conversa (por telefone). Use quando perguntarem sobre agendamentos existentes.",
      parameters: {
        type: "object",
        properties: {
          include_past: { type: "boolean", description: "Se true, inclui consultas passadas também" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_appointment",
      description: "Confirma presença em consulta agendada.",
      parameters: {
        type: "object",
        properties: { appointment_id: { type: "string" } },
        required: ["appointment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancela consulta do paciente.",
      parameters: {
        type: "object",
        properties: { appointment_id: { type: "string" } },
        required: ["appointment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_journey",
      description:
        "Consulta a jornada do contato no CRM: etapa atual, eventos pendentes e próxima ação sugerida. Use antes de decidir cadastro, agendamento ou follow-up.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "resolve_quote_offer",
      description:
        "Verifica se pode gerar orçamento para um procedimento: se precisa perguntar médico, lista profissionais com preço e validade.",
      parameters: {
        type: "object",
        properties: {
          procedure_id: { type: "string" },
          doctor_id: { type: "string" },
        },
        required: ["procedure_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_and_send_quote",
      description:
        "Cria orçamento, marca como enviado e manda resumo + PDF no WhatsApp. Só use após resolve_quote_offer sem needsDoctorChoice.",
      parameters: {
        type: "object",
        properties: {
          procedure_id: { type: "string" },
          doctor_id: { type: "string" },
        },
        required: ["procedure_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_quote_status",
      description: "Consulta status do último orçamento do contato (enviado, expirado, etc.).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_form_status",
      description: "Lista formulários pendentes ou respondidos das consultas futuras do paciente.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "resend_form_link",
      description: "Reenvia link de formulário pendente quando o paciente pedir (não substitui compliance automático).",
      parameters: {
        type: "object",
        properties: { appointment_id: { type: "string" } },
        required: ["appointment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payment_status",
      description:
        "Somente leitura: informa se há cobrança pendente no sistema. NUNCA registra pagamento.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Remarca consulta para novo horário ISO 8601.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          new_scheduled_at: { type: "string", description: "ISO 8601" },
        },
        required: ["appointment_id", "new_scheduled_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "collect_nps_feedback",
      description: "Registra nota NPS 0-10 e comentário opcional após atendimento.",
      parameters: {
        type: "object",
        properties: {
          score: { type: "number" },
          comment: { type: "string" },
          appointment_id: { type: "string" },
        },
        required: ["score"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_to_human",
      description:
        "Transfere para atendente humano. Use SOMENTE se o paciente pedir EXPLICITAMENTE para falar com atendente/pessoa humana. NUNCA use durante agendamento, dúvidas de horário ou quando não souber uma resposta — use as ferramentas.",
      parameters: {
        type: "object",
        properties: { reason: { type: "string" } },
      },
    },
  },
];

async function logToolCall(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  toolName: string,
  params: Record<string, unknown>,
  resultSummary: string,
  success: boolean
): Promise<void> {
  await supabase.from("whatsapp_ai_tool_log").insert({
    clinic_id: clinicId,
    conversation_id: conversationId,
    tool_name: toolName,
    params,
    result_summary: resultSummary.slice(0, 500),
    success,
  });
}

export type ToolContext = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  aiState: AiConversationState;
};

export async function executeAssistantTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>
): Promise<{ result: string; handoff?: boolean; statePatch?: Partial<AiConversationState> }> {
  const { supabase, clinicId, conversationId, phoneNumber } = ctx;

  try {
    switch (name) {
      case "lookup_patient_by_phone": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        const minimized = minimizePatientForAiToolResult(patient);
        const summary = patient ? `Paciente: ${minimized.display_name}` : "Paciente não cadastrado";
        await logToolCall(supabase, clinicId, conversationId, name, {}, summary, true);
        return {
          result: JSON.stringify(minimized),
          statePatch: patient
            ? { patient_id: patient.id, ...patchBookingStepFromTool(name, {}, patient as Record<string, unknown>, ctx.aiState) }
            : patchBookingStepFromTool(name, {}, { found: false }, ctx.aiState),
        };
      }

      case "register_patient": {
        const fullName = String(args.full_name ?? "").trim();
        if (!fullName) {
          return { result: JSON.stringify({ error: "Nome obrigatório." }) };
        }
        const res = await registerPatientViaAssistant(supabase, clinicId, {
          full_name: fullName,
          phone: phoneNumber,
          email: args.email ? String(args.email) : null,
        });
        if (res.patientId) {
          await linkConversationToPatient(supabase, clinicId, conversationId, res.patientId);
        }
        await logToolCall(supabase, clinicId, conversationId, name, { full_name: fullName }, res.error ?? "ok", !res.error);
        return {
          result: JSON.stringify(res),
          statePatch: res.patientId
            ? { patient_id: res.patientId, ...patchBookingStepFromTool(name, args, res as Record<string, unknown>, ctx.aiState) }
            : patchBookingStepFromTool(name, args, res as Record<string, unknown>, ctx.aiState),
        };
      }

      case "list_doctors": {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, specialty")
          .eq("clinic_id", clinicId)
          .eq("role", "medico")
          .order("full_name");
        const payload = {
          doctors: data ?? [],
          hint: "Apresente os nomes ao paciente e pergunte com qual profissional deseja agendar.",
        };
        await logToolCall(supabase, clinicId, conversationId, name, {}, `${data?.length ?? 0} médicos`, true);
        return { result: JSON.stringify(payload) };
      }

      case "list_procedures": {
        const doctorId = args.doctor_id ? String(args.doctor_id) : null;
        let procedureIds: string[] | null = null;
        if (doctorId) {
          const { data: dp } = await supabase
            .from("doctor_procedures")
            .select("procedure_id")
            .eq("clinic_id", clinicId)
            .eq("doctor_id", doctorId);
          procedureIds = (dp ?? []).map((r) => r.procedure_id);
        }
        let query = supabase
          .from("procedures")
          .select("id, name, duration_minutes")
          .eq("clinic_id", clinicId)
          .order("display_order");
        if (procedureIds) {
          if (!procedureIds.length) return { result: JSON.stringify([]) };
          query = query.in("id", procedureIds);
        }
        const { data } = await query;
        const payload = {
          procedures: data ?? [],
          hint: "Apresente em lista numerada e pergunte qual procedimento o paciente deseja.",
        };
        await logToolCall(supabase, clinicId, conversationId, name, { doctor_id: doctorId }, `${data?.length ?? 0} procedimentos`, true);
        return { result: JSON.stringify(payload) };
      }

      case "find_available_slots": {
        const doctorId = String(args.doctor_id);
        const procedureId = String(args.procedure_id);
        const daysAhead = Number(args.days_ahead) || 14;
        const date = args.date ? String(args.date) : undefined;
        const period = normalizeSlotPeriod(args.period);
        const skipDays = Number(args.skip_days) || 0;

        if (date) {
          const slots = await findSlotsForDay(supabase, {
            clinicId,
            doctorId,
            procedureId,
            date,
            period,
            excludeAppointmentId: ctx.aiState.last_created_appointment_id ?? null,
            patientId: ctx.aiState.patient_id ?? null,
          });
          const availablePeriods = await findAvailablePeriodsForDay(supabase, {
            clinicId,
            doctorId,
            procedureId,
            date,
          });
          const periodLabel = period ? formatSlotPeriodLabel(period) : null;
          const payload = {
            mode: "times" as const,
            date,
            period: period ?? null,
            slots,
            available_periods: availablePeriods.map(formatSlotPeriodLabel),
            display_message:
              slots.length > 0 ? buildSlotsDisplayMessage(slots) : null,
            hint:
              slots.length > 0
                ? periodLabel
                  ? `Use display_message como lista de horários (pode adicionar uma frase curta antes). NUNCA invente ou altere horários.`
                  : "Use display_message como lista de horários. NUNCA invente horários. Se o paciente preferir turno, chame novamente com period."
                : periodLabel
                  ? `Nenhum horário na ${periodLabel}. available_periods indica turnos livres neste dia. NUNCA invente horários — ofereça os turnos de available_periods ou outro dia.`
                  : "Nenhum horário neste dia. NUNCA invente horários — sugira outro dia da lista anterior.",
          };
          await logToolCall(
            supabase,
            clinicId,
            conversationId,
            name,
            args,
            `${slots.length} horários em ${date}`,
            true
          );
          return {
            result: JSON.stringify(payload),
            statePatch: {
              ...buildOfferedStateFromSlotsTool(
                "times",
                { date, period, slots },
                doctorId,
                procedureId,
                ctx.aiState
              ),
            },
          };
        }

        const { days, hasMore } = await findAvailableDays(supabase, {
          clinicId,
          doctorId,
          procedureId,
          daysAhead,
          skipDays,
        });
        const daysForDisplay = days.map((d) => ({
          ...d,
          periods_label: formatPeriodsLabel(d.periods),
        }));
        const payload = {
          mode: "days" as const,
          days: daysForDisplay,
          has_more: hasMore,
          skip_days_used: skipDays,
          next_skip_days: skipDays + days.length,
          display_message:
            daysForDisplay.length > 0 ? buildDaysDisplayMessage(daysForDisplay) : null,
          hint:
            daysForDisplay.length > 0
              ? hasMore
                ? "Use display_message como lista de dias (pode adicionar frase curta antes). NUNCA invente datas ou turnos. Se o paciente disser não, chame com skip_days = next_skip_days."
                : "Use display_message como lista de dias. Depois chame com date para horários. NUNCA invente datas ou turnos."
              : "Nenhum dia disponível no período. NUNCA invente datas — sugira outro procedimento/médico ou peça para tentar mais tarde.",
        };
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          args,
          `${days.length} dias`,
          true
        );
        return {
          result: JSON.stringify(payload),
          statePatch: {
            ...buildOfferedStateFromSlotsTool(
              "days",
              { days: daysForDisplay },
              doctorId,
              procedureId,
              ctx.aiState
            ),
          },
        };
      }

      case "create_appointment": {
        const res = await createAppointmentViaAssistant(supabase, {
          clinicId,
          patientId: String(args.patient_id),
          doctorId: String(args.doctor_id),
          procedureId: String(args.procedure_id),
          scheduledAt: String(args.scheduled_at),
          dimensionValueIds: (args.dimension_value_ids as string[]) ?? [],
        });
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? res.appointmentId ?? "ok", !res.error);

        const stepPatch = patchBookingStepFromTool(name, args, res as Record<string, unknown>, ctx.aiState);

        if (res.appointmentId && !res.error) {
          const confirmationText = await formatAppointmentConfirmationMessage(supabase, {
            clinicId,
            appointmentId: res.appointmentId,
            patientId: String(args.patient_id),
          });
          return {
            result: JSON.stringify({
              ...res,
              confirmation_message: confirmationText,
              hint: "Use confirmation_message como resposta ao paciente — não reescreva como confirmado antes disso.",
            }),
            statePatch: stepPatch,
          };
        }

        return {
          result: JSON.stringify({
            ...res,
            hint: res.error?.includes("já tem consulta")
              ? "Chame list_patient_appointments — pode ser a consulta deste paciente."
              : undefined,
          }),
          statePatch: stepPatch,
        };
      }

      case "get_procedure_info": {
        const info = await getProcedureInfo(supabase, clinicId, String(args.procedure_id));
        await logToolCall(supabase, clinicId, conversationId, name, args, info?.name ?? "n/a", !!info);
        return { result: JSON.stringify(info ?? { error: "Não encontrado" }) };
      }

      case "get_service_price": {
        let serviceId = args.service_id ? String(args.service_id) : null;
        const doctorId = String(args.doctor_id);
        if (!serviceId && args.procedure_id) {
          const proc = await getProcedureInfo(supabase, clinicId, String(args.procedure_id));
          serviceId = proc?.default_service_id ?? null;
        }
        if (!serviceId) {
          return { result: JSON.stringify({ error: "Serviço não configurado para este procedimento." }) };
        }
        const price = await resolveServicePriceForClinic(
          supabase,
          clinicId,
          serviceId,
          doctorId,
          (args.dimension_value_ids as string[]) ?? []
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, String(price.valor), !price.error);
        return { result: JSON.stringify({ service_id: serviceId, ...price }) };
      }

      case "list_price_options": {
        const result = await listPriceOptionsForClinic(supabase, clinicId, {
          serviceId: args.service_id ? String(args.service_id) : null,
          procedureId: args.procedure_id ? String(args.procedure_id) : null,
          doctorId: args.doctor_id ? String(args.doctor_id) : null,
        });
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          args,
          result.fixed_price != null ? String(result.fixed_price) : result.price_range ?? "dims",
          !result.error
        );
        return {
          result: JSON.stringify({
            ...result,
            hint: result.needs_dimensions
              ? "Pergunte qual opção se aplica (ex.: convênio) e use get_service_price com dimension_value_ids."
              : "Informe o valor ao paciente em reais.",
          }),
          statePatch: args.procedure_id
            ? { procedure_id: String(args.procedure_id), intent: "price" }
            : { intent: "price" },
        };
      }

      case "list_services": {
        const services = await listServicesForClinic(supabase, clinicId);
        await logToolCall(supabase, clinicId, conversationId, name, {}, `${services.length} serviços`, true);
        return {
          result: JSON.stringify({
            services,
            hint: "Apresente os serviços e procedimentos relacionados ao paciente.",
          }),
        };
      }

      case "list_patient_appointments": {
        const patient =
          ctx.aiState.patient_id != null
            ? { id: ctx.aiState.patient_id }
            : await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient?.id) {
          return { result: JSON.stringify({ error: "Paciente não cadastrado.", appointments: [] }) };
        }
        const appointments = await listPatientAppointmentsViaAssistant(
          supabase,
          clinicId,
          patient.id,
          { upcomingOnly: !args.include_past }
        );
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          args,
          `${appointments.length} consultas`,
          true
        );
        return {
          result: JSON.stringify({
            appointments,
            hint: "Apresente data, médico e procedimento. Use confirm_appointment ou cancel_appointment com o id interno.",
          }),
          statePatch: { patient_id: patient.id, intent: "appointments" },
        };
      }

      case "confirm_appointment": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: JSON.stringify({ error: "Paciente não encontrado." }) };
        const res = await confirmAppointmentViaAssistant(
          supabase,
          clinicId,
          String(args.appointment_id),
          patient.id
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "confirmada", !res.error);
        return { result: JSON.stringify(res) };
      }

      case "cancel_appointment": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: JSON.stringify({ error: "Paciente não encontrado." }) };
        const res = await cancelAppointmentViaAssistant(
          supabase,
          clinicId,
          String(args.appointment_id),
          patient.id
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "cancelada", !res.error);
        return { result: JSON.stringify(res) };
      }

      case "get_contact_journey": {
        const { loadContactJourneyForAi } = await import("@/lib/contact-journey/journey-for-ai");
        const res = await loadContactJourneyForAi(supabase, {
          clinicId,
          phone: phoneNumber,
          patientId: ctx.aiState.patient_id,
        });
        const summary = res.summary ?? "Nenhuma jornada ativa encontrada para este contato.";
        await logToolCall(supabase, clinicId, conversationId, name, {}, summary.slice(0, 200), true);
        return {
          result: JSON.stringify({
            summary: res.summary,
            current_step: res.journey?.currentStep ?? null,
            suggested_action: res.journey?.suggestedAction?.label ?? null,
            phase: res.journey?.phase ?? null,
          }),
          statePatch: res.journey?.currentStep
            ? { journey_step_code: res.journey.currentStep }
            : {},
        };
      }

      case "resolve_quote_offer": {
        const { resolveQuoteOfferViaAssistant } = await import("../services/quotes");
        const res = await resolveQuoteOfferViaAssistant(supabase, {
          clinicId,
          procedureId: String(args.procedure_id),
          doctorId: args.doctor_id ? String(args.doctor_id) : null,
        });
        await logToolCall(supabase, clinicId, conversationId, name, args, res.hint.slice(0, 120), true);
        return {
          result: JSON.stringify(res),
          statePatch: {
            procedure_id: String(args.procedure_id),
            doctor_id: res.autoSelectedDoctorId ?? undefined,
            intent: "quote",
          },
        };
      }

      case "create_and_send_quote": {
        const { createAndSendQuoteViaAssistant } = await import("../services/quotes");
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        const res = await createAndSendQuoteViaAssistant(supabase, {
          clinicId,
          conversationId,
          phoneNumber,
          procedureId: String(args.procedure_id),
          doctorId: args.doctor_id ? String(args.doctor_id) : ctx.aiState.doctor_id,
          patientId: patient?.id ?? ctx.aiState.patient_id,
        });
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          args,
          res.error ?? res.quoteId ?? "ok",
          !res.error
        );
        return { result: JSON.stringify(res) };
      }

      case "get_quote_status": {
        const { getLatestQuoteStatusForContact } = await import("../services/quotes");
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        const res = await getLatestQuoteStatusForContact(supabase, clinicId, {
          patientId: patient?.id ?? ctx.aiState.patient_id,
          phone: phoneNumber,
        });
        await logToolCall(supabase, clinicId, conversationId, name, {}, JSON.stringify(res).slice(0, 120), true);
        return { result: JSON.stringify(res) };
      }

      case "get_form_status": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: JSON.stringify({ error: "Paciente não encontrado." }) };
        const { getFormStatusViaAssistant } = await import("../services/forms");
        const res = await getFormStatusViaAssistant(supabase, clinicId, patient.id);
        await logToolCall(supabase, clinicId, conversationId, name, {}, `${res.forms.length} forms`, true);
        return { result: JSON.stringify(res) };
      }

      case "resend_form_link": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: JSON.stringify({ error: "Paciente não encontrado." }) };
        const { resendFormLinkViaAssistant } = await import("../services/forms");
        const res = await resendFormLinkViaAssistant(
          supabase,
          clinicId,
          String(args.appointment_id),
          patient.id
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, `sent:${res.sent}`, !res.error);
        return { result: JSON.stringify(res) };
      }

      case "get_payment_status": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: JSON.stringify({ error: "Paciente não encontrado." }) };
        const { getPaymentStatusViaAssistant } = await import("../services/payments");
        const res = await getPaymentStatusViaAssistant(supabase, clinicId, patient.id);
        await logToolCall(supabase, clinicId, conversationId, name, {}, res.message.slice(0, 120), true);
        return { result: JSON.stringify(res) };
      }

      case "reschedule_appointment": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: JSON.stringify({ error: "Paciente não encontrado." }) };
        const res = await rescheduleAppointmentViaAssistant(supabase, {
          clinicId,
          appointmentId: String(args.appointment_id),
          patientId: patient.id,
          newScheduledAt: String(args.new_scheduled_at),
        });
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "remarcada", !res.error);
        return { result: JSON.stringify(res) };
      }

      case "collect_nps_feedback": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: JSON.stringify({ error: "Paciente não encontrado." }) };
        const { collectNpsFeedbackViaAssistant } = await import("../services/nps");
        const res = await collectNpsFeedbackViaAssistant(supabase, {
          clinicId,
          patientId: patient.id,
          conversationId,
          appointmentId: args.appointment_id ? String(args.appointment_id) : undefined,
          score: Number(args.score),
          comment: args.comment ? String(args.comment) : undefined,
        });
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "nps", !res.error);
        return { result: JSON.stringify(res) };
      }

      case "transfer_to_human": {
        const reason = String(args.reason ?? "").toLowerCase();
        const inBooking = isActiveBookingState(ctx.aiState);
        const explicitHumanRequest =
          reason.includes("human_request") ||
          reason.includes("user_handoff") ||
          reason.includes("complaint") ||
          reason.includes("pedido explícito");

        if (inBooking && !explicitHumanRequest) {
          await logToolCall(
            supabase,
            clinicId,
            conversationId,
            name,
            args,
            "bloqueado durante agendamento",
            false
          );
          return {
            result: JSON.stringify({
              error:
                "Transferência bloqueada durante agendamento. Continue ajudando com find_available_slots e create_appointment. Só transfira se o paciente pedir explicitamente atendente humano.",
            }),
          };
        }

        const { data: vaSettings } = await supabase
          .from("clinic_virtual_assistant_settings")
          .select("*")
          .eq("clinic_id", clinicId)
          .maybeSingle();
        const { isInsideHandoffWindow, handoffOutsideHoursMessage } = await import(
          "../handoff-hours"
        );
        if (vaSettings && !isInsideHandoffWindow(vaSettings)) {
          await logToolCall(
            supabase,
            clinicId,
            conversationId,
            name,
            args,
            "fora do horário de handoff",
            false
          );
          return {
            result: JSON.stringify({
              error: handoffOutsideHoursMessage(vaSettings),
              outside_handoff_hours: true,
            }),
          };
        }

        await supabase
          .from("whatsapp_conversations")
          .update({
            ai_handoff_at: new Date().toISOString(),
            ai_enabled: false,
          })
          .eq("id", conversationId);
        await applyRoutingOnNewConversation(supabase, clinicId, conversationId);
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          args,
          String(args.reason ?? "handoff"),
          true
        );
        return { result: JSON.stringify({ transferred: true }), handoff: true };
      }

      default:
        return { result: JSON.stringify({ error: `Ferramenta desconhecida: ${name}` }) };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na ferramenta";
    await logToolCall(supabase, clinicId, conversationId, name, args, msg, false);
    return { result: JSON.stringify({ error: msg }) };
  }
}
