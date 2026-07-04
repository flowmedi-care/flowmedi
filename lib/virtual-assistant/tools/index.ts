import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSISTANT_TOOLS } from "./definitions";

export { ASSISTANT_TOOLS } from "./definitions";
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
import type { AgentPipelineStage } from "../agent-pipeline/stages";
import type { ToolExecutionModesConfig } from "../agent-pipeline/confirmation-policy";
import {
  validateToolExecution,
  patchStateFromToolResult,
  isToolAllowedInStage,
  logPipelineToolBlocked,
  incrementToolFailureCount,
  resetToolFailureCount,
  MAX_CONSECUTIVE_TOOL_FAILURES,
} from "../agent-pipeline";

async function logToolCall(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  toolName: string,
  params: Record<string, unknown>,
  resultSummary: string,
  success: boolean,
  ctx?: ToolContext,
  blockReason?: string | null
): Promise<void> {
  await supabase.from("whatsapp_ai_tool_log").insert({
    clinic_id: clinicId,
    conversation_id: conversationId,
    tool_name: toolName,
    params,
    result_summary: resultSummary.slice(0, 500),
    success,
    pipeline_stage: ctx?.pipelineStage ?? null,
    block_reason: blockReason ?? null,
  });
}

export type ToolContext = {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  aiState: AiConversationState;
  pipelineStage?: AgentPipelineStage;
  parallelStages?: AgentPipelineStage[];
  toolExecutionModes?: ToolExecutionModesConfig;
  skipPipelineValidation?: boolean;
};

export type FilterToolsContext = {
  mainStage: AgentPipelineStage;
  parallelStages?: AgentPipelineStage[];
  includeFinanceRead?: boolean;
};

export async function executeAssistantTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>
): Promise<{ result: string; handoff?: boolean; statePatch?: Partial<AiConversationState> }> {
  const { supabase, clinicId, conversationId, phoneNumber } = ctx;

  if (ctx.pipelineStage && !ctx.skipPipelineValidation) {
    const filterCtx = {
      mainStage: ctx.pipelineStage,
      parallelStages: ctx.parallelStages,
      includeFinanceRead: ctx.aiState.intent === "payment",
    };
    if (!isToolAllowedInStage(name, filterCtx)) {
      logPipelineToolBlocked(supabase, {
        clinicId,
        conversationId,
        toolName: name,
        stage: ctx.pipelineStage,
        reason: "Ferramenta não permitida nesta etapa do pipeline",
      });
      await logToolCall(
        supabase,
        clinicId,
        conversationId,
        name,
        args,
        "bloqueada pelo pipeline",
        false,
        ctx,
        "Ferramenta não permitida nesta etapa do pipeline"
      );
      return {
        result: JSON.stringify({
          error: "Ferramenta não disponível nesta etapa da conversa.",
          hint: "Use apenas as ferramentas permitidas para a etapa atual ou peça esclarecimento ao paciente.",
          pipeline_stage: ctx.pipelineStage,
        }),
      };
    }

    const validation = validateToolExecution(name, args, ctx.aiState, ctx.pipelineStage);
    if (!validation.ok) {
      await logToolCall(
        supabase,
        clinicId,
        conversationId,
        name,
        args,
        validation.error,
        false,
        ctx,
        validation.error
      );
      return {
        result: JSON.stringify({
          error: validation.error,
          hint: validation.hint,
          missing: validation.missing,
        }),
        statePatch: incrementToolFailureCount(ctx.aiState),
      };
    }
  }

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
        const appointmentId = String(args.appointment_id);
        const reason = args.cancellation_reason === "reschedule" ? "reschedule" : args.cancellation_reason === "dropped" ? "dropped" : "other";

        if (reason === "reschedule") {
          await logToolCall(supabase, clinicId, conversationId, name, args, "fluxo remarcação", true, ctx);
          return {
            result: JSON.stringify({
              ok: true,
              reschedule_flow: true,
              appointment_id: appointmentId,
              hint: "Paciente quer remarcar. Use find_available_slots e reschedule_appointment, ou pergunte novo horário.",
            }),
            statePatch: {
              pipeline_stage: "agendamento",
              intent: "reschedule",
              pending_reschedule_appointment_id: appointmentId,
              pending_confirmation_appointment_id: undefined,
            },
          };
        }

        const res = await cancelAppointmentViaAssistant(
          supabase,
          clinicId,
          appointmentId,
          patient.id
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "cancelada", !res.error, ctx);
        return { result: JSON.stringify({ ...res, cancellation_reason: reason }) };
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
            resolve_quote_offer_done: true,
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

      case "infer_dropout_reason": {
        const { inferAndPersistDropoutForConversation } = await import("@/lib/contact-journey/dropout-inference");
        const journeyStep =
          (args.journey_step ? String(args.journey_step) : null) ??
          ctx.aiState.journey_step_code ??
          null;
        const result = await inferAndPersistDropoutForConversation(supabase, {
          clinicId,
          conversationId,
          patientId: ctx.aiState.patient_id,
          journeyStep: journeyStep as import("@/lib/contact-journey/types").JourneyStepCode | null,
        });
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          args,
          result.motivoProvavel,
          true,
          ctx
        );
        return {
          result: JSON.stringify(result),
          statePatch: {
            motivo_provavel: result.motivoProvavel,
            confianca: result.confianca,
          },
        };
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
