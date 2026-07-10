import type { SupabaseClient } from "@supabase/supabase-js";
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
import { applyRoutingOnNewConversation } from "@/lib/whatsapp-routing";
import {
  cancelAppointmentViaAssistant,
  createAppointmentViaAssistant,
  formatAppointmentConfirmationMessage,
  listPatientAppointmentsViaAssistant,
  rescheduleAppointmentViaAssistant,
} from "@/lib/virtual-assistant/services/appointments";
import {
  linkConversationToPatient,
  lookupPatientByPhone,
  registerPatientViaAssistant,
} from "@/lib/virtual-assistant/services/patients";
import {
  getProcedureInfo,
  listPriceOptionsForClinic,
  resolveServicePriceForClinic,
} from "@/lib/virtual-assistant/services/pricing";
import { minimizePatientForAiToolResult } from "@/lib/virtual-assistant/minimize-patient-for-ai";
import { searchFaqWithFallback } from "../knowledge/faq-retrieval";
import type { ToolContext, ToolExecutionOutcome } from "./types";
import {
  domainError,
  missingResult,
  successResult,
} from "./types";
import { isChatbotTool } from "./definitions";

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
    pipeline_stage: null,
    block_reason: null,
  });
}

export async function executeTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>
): Promise<ToolExecutionOutcome> {
  if (!isChatbotTool(name)) {
    return {
      result: domainError(`Ferramenta desconhecida: ${name}`),
    };
  }

  const { supabase, clinicId, conversationId, phoneNumber } = ctx;

  try {
    switch (name) {
      case "lookup_patient_by_phone": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        const minimized = minimizePatientForAiToolResult(patient);
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          {},
          patient ? `Paciente: ${minimized.display_name}` : "não cadastrado",
          true
        );
        return {
          result: successResult({
            found: Boolean(patient),
            patient_id: patient?.id ?? null,
            ...minimized,
          }),
          statePatch: patient ? { patient_id: patient.id } : undefined,
        };
      }

      case "register_patient": {
        const fullName = String(args.full_name ?? "").trim();
        if (!fullName) {
          return { result: missingResult(["full_name"], "Pergunte o nome completo do paciente.") };
        }
        const res = await registerPatientViaAssistant(supabase, clinicId, {
          full_name: fullName,
          phone: phoneNumber,
          email: args.email ? String(args.email) : null,
        });
        if (res.error) {
          await logToolCall(supabase, clinicId, conversationId, name, args, res.error, false);
          return { result: domainError(res.error) };
        }
        if (res.patientId) {
          await linkConversationToPatient(supabase, clinicId, conversationId, res.patientId);
        }
        await logToolCall(supabase, clinicId, conversationId, name, { full_name: fullName }, "ok", true);
        return {
          result: successResult(res),
          statePatch: res.patientId ? { patient_id: res.patientId } : undefined,
        };
      }

      case "list_doctors": {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, specialty")
          .eq("clinic_id", clinicId)
          .eq("role", "medico")
          .order("full_name");
        await logToolCall(supabase, clinicId, conversationId, name, {}, `${data?.length ?? 0} médicos`, true);
        return {
          result: successResult({
            doctors: data ?? [],
          }),
        };
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
          if (!procedureIds.length) {
            return { result: successResult({ procedures: [] }) };
          }
          query = query.in("id", procedureIds);
        }
        const { data } = await query;
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          { doctor_id: doctorId },
          `${data?.length ?? 0} procedimentos`,
          true
        );
        return {
          result: successResult({ procedures: data ?? [] }),
          statePatch: doctorId
            ? { booking: { ...ctx.aiState.booking, doctor_id: doctorId, status: ctx.aiState.booking?.status ?? "collecting" } }
            : undefined,
        };
      }

      case "find_available_slots": {
        const doctorId = String(args.doctor_id ?? ctx.aiState.booking?.doctor_id ?? "");
        const procedureId = String(args.procedure_id ?? ctx.aiState.booking?.procedure_id ?? "");
        if (!doctorId) {
          return { result: missingResult(["doctor_id"], "Informe o médico antes de buscar horários.") };
        }
        if (!procedureId) {
          return { result: missingResult(["procedure_id"], "Informe o procedimento antes de buscar horários.") };
        }

        const daysAhead = Number(args.days_ahead) || 14;
        const date = args.date ? String(args.date) : undefined;
        const period = normalizeSlotPeriod(args.period);
        const skipDays = Number(args.skip_days) || 0;

        const { count: doctorProcedureCount } = await supabase
          .from("doctor_procedures")
          .select("procedure_id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("doctor_id", doctorId);

        if ((doctorProcedureCount ?? 0) > 0) {
          const { data: doctorProcedure } = await supabase
            .from("doctor_procedures")
            .select("procedure_id")
            .eq("clinic_id", clinicId)
            .eq("doctor_id", doctorId)
            .eq("procedure_id", procedureId)
            .maybeSingle();
          if (!doctorProcedure) {
            await logToolCall(supabase, clinicId, conversationId, name, args, "par inválido", false);
            return {
              result: domainError(
                "Este profissional não realiza o procedimento selecionado.",
                "Liste médicos ou procedimentos compatíveis."
              ),
            };
          }
        }

        if (date) {
          const slots = await findSlotsForDay(supabase, {
            clinicId,
            doctorId,
            procedureId,
            date,
            period,
            patientId: ctx.aiState.patient_id ?? null,
          });
          const availablePeriods = await findAvailablePeriodsForDay(supabase, {
            clinicId,
            doctorId,
            procedureId,
            date,
          });
          const payload = {
            mode: "times" as const,
            date,
            period: period ?? null,
            slots,
            available_periods: availablePeriods.map(formatSlotPeriodLabel),
            display_message: slots.length > 0 ? buildSlotsDisplayMessage(slots) : null,
          };
          await logToolCall(supabase, clinicId, conversationId, name, args, `${slots.length} horários`, true);
          return {
            result: successResult(payload),
            statePatch: {
              booking: {
                procedure_id: procedureId,
                doctor_id: doctorId,
                date,
                offered_slots: slots.map((s) => ({
                  scheduled_at: s.scheduled_at,
                  display: s.label,
                })),
                status: slots.length === 1 ? "confirming" : "collecting",
              },
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
        };
        await logToolCall(supabase, clinicId, conversationId, name, args, `${days.length} dias`, true);
        return {
          result: successResult(payload),
          statePatch: {
            booking: {
              procedure_id: procedureId,
              doctor_id: doctorId,
              status: "collecting",
            },
          },
        };
      }

      case "create_appointment": {
        const offeredSlots = ctx.aiState.booking?.offered_slots ?? [];
        const res = await createAppointmentViaAssistant(supabase, {
          clinicId,
          patientId: String(args.patient_id ?? ctx.aiState.patient_id),
          doctorId: String(args.doctor_id ?? ctx.aiState.booking?.doctor_id),
          procedureId: String(args.procedure_id ?? ctx.aiState.booking?.procedure_id),
          scheduledAt: String(args.scheduled_at ?? ctx.aiState.booking?.pending_slot),
          dimensionValueIds: [],
          offeredSlots,
        });
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          args,
          res.error ?? res.appointmentId ?? "ok",
          !res.error
        );
        if (res.error) {
          return { result: domainError(res.error) };
        }
        const confirmationText = await formatAppointmentConfirmationMessage(supabase, {
          clinicId,
          appointmentId: res.appointmentId!,
          patientId: String(args.patient_id ?? ctx.aiState.patient_id),
        });
        return {
          result: successResult({
            appointmentId: res.appointmentId,
            confirmation_message: confirmationText,
          }),
          statePatch: { booking: { status: "done" } },
        };
      }

      case "list_patient_appointments": {
        const patient =
          ctx.aiState.patient_id != null
            ? { id: ctx.aiState.patient_id }
            : await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient?.id) {
          return {
            result: domainError("Paciente não cadastrado."),
          };
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
        const ids = appointments.map((a) => a.id).filter(Boolean) as string[];
        return {
          result: successResult({ appointments }),
          statePatch: {
            patient_id: patient.id,
            active_appointments: ids,
            focused_appointment_id: ids.length === 1 ? ids[0] : undefined,
          },
        };
      }

      case "cancel_appointment": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: domainError("Paciente não encontrado.") };
        const appointmentId = String(
          args.appointment_id ?? ctx.aiState.focused_appointment_id ?? ctx.aiState.active_appointments?.[0] ?? ""
        );
        const reason = args.cancellation_reason === "reschedule" ? "reschedule" : "other";

        if (reason === "reschedule") {
          await logToolCall(supabase, clinicId, conversationId, name, args, "fluxo remarcação", true);
          return {
            result: successResult({
              reschedule_flow: true,
              appointment_id: appointmentId,
            }),
            statePatch: {
              focused_appointment_id: appointmentId,
              booking: { status: "collecting" },
            },
          };
        }

        const res = await cancelAppointmentViaAssistant(
          supabase,
          clinicId,
          appointmentId,
          patient.id
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "cancelada", !res.error);
        if (res.error) return { result: domainError(res.error) };
        return {
          result: successResult(res),
          statePatch: { focused_appointment_id: undefined },
        };
      }

      case "reschedule_appointment": {
        const patient = await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient) return { result: domainError("Paciente não encontrado.") };
        const appointmentId = String(
          args.appointment_id ?? ctx.aiState.focused_appointment_id ?? ""
        );
        if (!appointmentId) {
          return { result: missingResult(["appointment_id"], "Informe qual consulta remarcar.") };
        }
        const newScheduledAt = String(args.new_scheduled_at ?? "");
        if (!newScheduledAt) {
          return { result: missingResult(["new_scheduled_at"], "Informe o novo horário desejado.") };
        }
        const res = await rescheduleAppointmentViaAssistant(supabase, {
          clinicId,
          appointmentId,
          patientId: patient.id,
          newScheduledAt,
        });
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "remarcada", !res.error);
        if (res.error) return { result: domainError(res.error) };
        return { result: successResult(res) };
      }

      case "get_service_price": {
        const doctorId = args.doctor_id
          ? String(args.doctor_id)
          : ctx.aiState.booking?.doctor_id;
        if (!doctorId) {
          return { result: missingResult(["doctor_id"], "Informe o médico para consultar o preço.") };
        }
        let serviceId = args.service_id ? String(args.service_id) : null;
        if (!serviceId && args.procedure_id) {
          const proc = await getProcedureInfo(supabase, clinicId, String(args.procedure_id));
          serviceId = proc?.default_service_id ?? null;
        }
        if (!serviceId && ctx.aiState.booking?.procedure_id) {
          const proc = await getProcedureInfo(supabase, clinicId, ctx.aiState.booking.procedure_id);
          serviceId = proc?.default_service_id ?? null;
        }
        if (!serviceId) {
          return {
            result: missingResult(
              ["procedure_id"],
              "Informe o procedimento ou serviço para consultar o preço."
            ),
          };
        }
        const price = await resolveServicePriceForClinic(
          supabase,
          clinicId,
          serviceId,
          doctorId,
          []
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, String(price.valor), !price.error);
        if (price.error) return { result: domainError(price.error) };
        return {
          result: successResult({ service_id: serviceId, ...price }),
          statePatch: args.procedure_id
            ? {
                booking: {
                  ...ctx.aiState.booking,
                  procedure_id: String(args.procedure_id),
                  status: ctx.aiState.booking?.status ?? "collecting",
                },
              }
            : undefined,
        };
      }

      case "search_faq": {
        const query = String(args.query ?? "").trim();
        if (!query) {
          return { result: missingResult(["query"], "Informe o que o paciente quer saber.") };
        }
        const hit = await searchFaqWithFallback(query, ctx.faqs, supabase, clinicId);
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          { query },
          hit ? hit.question.slice(0, 80) : "não encontrado",
          Boolean(hit)
        );
        if (!hit) {
          return {
            result: domainError(
              "Não encontrei essa informação nas perguntas frequentes.",
              "Tente list_procedures ou transfer_to_human."
            ),
          };
        }
        return { result: successResult(hit) };
      }

      case "transfer_to_human": {
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
        return {
          result: successResult({ transferred: true }),
          handoff: true,
        };
      }

      default:
        return { result: domainError(`Ferramenta não implementada: ${name}`) };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logToolCall(supabase, clinicId, conversationId, name, args, message, false);
    return { result: domainError(message) };
  }
}
