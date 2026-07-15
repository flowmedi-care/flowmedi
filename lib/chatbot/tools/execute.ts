import type { SupabaseClient } from "@supabase/supabase-js";
import {
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
  listCancellableAppointmentsWithPhoneFallback,
  rescheduleAppointmentViaAssistant,
} from "@/lib/virtual-assistant/services/appointments";
import {
  linkConversationToPatient,
  lookupPatientByPhone,
  registerPatientViaAssistant,
  updatePatientIntakeViaAssistant,
} from "@/lib/virtual-assistant/services/patients";
import { computePendencies, completeCurrentOperation, syncFlowState, getWorkflowFromConfig } from "@/lib/attendance-flow/engine";
import { mergeClinicFlowConfig, buildGoalRegistry } from "@/lib/attendance-flow/flow-sync";
import {
  DEFAULT_WORKFLOW_CANCELAMENTO,
  DEFAULT_WORKFLOW_CONSULTA,
  DEFAULT_WORKFLOW_REMARCACAO,
} from "@/lib/attendance-flow/defaults";
import {
  getProcedureInfo,
  resolveServicePriceForClinic,
} from "@/lib/virtual-assistant/services/pricing";
import { minimizePatientForAiToolResult } from "@/lib/virtual-assistant/minimize-patient-for-ai";
import { normalizeCpf } from "@/lib/virtual-assistant/normalize-cpf";
import { outcomeFromServiceError } from "./error-class";
import { searchFaqWithFallback } from "../knowledge/faq-retrieval";
import type { ToolContext, ToolExecutionOutcome, ToolOption } from "./types";
import {
  errorResult,
  needsInputResult,
  notFoundResult,
  successResult,
  unavailableResult,
} from "./types";
import { isChatbotTool } from "./definitions";
import { resolveCreateAppointmentScheduledAt } from "../state/patch";
import { focusedAfterAppointmentListRefresh } from "../state/resolve-cancel-appointment-id";
import { hydrateBookingFromAppointment } from "../state/hydrate-booking-from-appointment";
import {
  resolveBookingDate,
  resolveBookingDateFailureMessage,
} from "../state/resolve-booking-date";
import { resolveBookingEntityId } from "../state/resolve-entity-id";
import { DEFAULT_CLINIC_TIMEZONE } from "@/lib/clinic-timezone";
import type { AiState } from "../state/types";
import type { AppointmentListRenderMode } from "./render-structured";
import { formatWhenLabel } from "./render-structured";

/** Current Operation in Selecting → select; otherwise browse. */
function resolveAppointmentListRenderMode(aiState: AiState): AppointmentListRenderMode {
  const flow = aiState.conversation_flow;
  if (flow?.current_operation?.status === "completed") {
    return "browse";
  }
  if (
    flow?.active_workflow_id === "cancelamento" &&
    flow.pending.includes("appointment_selected") &&
    flow.pending.includes("cancel_booking") &&
    !aiState.focused_appointment_id?.trim()
  ) {
    return "select";
  }
  if (
    flow?.active_workflow_id === "reschedule" &&
    flow.pending.includes("appointment_selected") &&
    flow.pending.includes("reschedule_booking") &&
    !aiState.focused_appointment_id?.trim()
  ) {
    return "select";
  }
  return "browse";
}

function isMissingToolLogColumnError(message: string): boolean {
  return (
    /column .* does not exist/i.test(message) &&
    (/block_reason|pipeline_stage/i.test(message) ||
      message.includes("whatsapp_ai_tool_log"))
  );
}

async function logToolCall(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  toolName: string,
  params: Record<string, unknown>,
  resultSummary: string,
  success: boolean,
  status?: string,
  blockReason?: string | null
): Promise<void> {
  const resultLabel = `[${status ?? (success ? "success" : "error")}] ${resultSummary}`.slice(
    0,
    500
  );
  const baseRow = {
    clinic_id: clinicId,
    conversation_id: conversationId,
    tool_name: toolName,
    params,
    result_summary: resultLabel,
    success,
  };

  const extended = await supabase.from("whatsapp_ai_tool_log").insert({
    ...baseRow,
    pipeline_stage: status ?? null,
    block_reason: blockReason ?? null,
  });

  if (!extended.error) return;

  if (!isMissingToolLogColumnError(extended.error.message)) {
    console.warn("[chatbot:tool-log] insert failed:", extended.error.message, { toolName });
    return;
  }

  const fallback = await supabase.from("whatsapp_ai_tool_log").insert(baseRow);
  if (fallback.error) {
    console.warn("[chatbot:tool-log] fallback insert failed:", fallback.error.message, {
      toolName,
    });
    return;
  }

  console.warn(
    "[chatbot:tool-log] using base columns only — apply migration-pipeline-tool-log-metrics.sql for block_reason"
  );
}

/** Log validator blocks so diagnostics show why executeTool never ran. */
export async function logBlockedToolCall(
  supabase: SupabaseClient,
  clinicId: string,
  conversationId: string,
  toolName: string,
  params: Record<string, unknown>,
  blockReason: string
): Promise<void> {
  await logToolCall(
    supabase,
    clinicId,
    conversationId,
    toolName,
    params,
    blockReason,
    false,
    "blocked",
    blockReason
  );
}

function buildDoctorOptions(
  doctors: Array<{ id: string; full_name: string }>
): ToolOption[] {
  return doctors.map((d, i) => ({
    id: d.id,
    label: d.full_name,
    index: i + 1,
  }));
}

function buildProcedureOptions(
  procedures: Array<{ id: string; name: string }>
): ToolOption[] {
  return procedures.map((p, i) => ({
    id: p.id,
    label: p.name,
    index: i + 1,
  }));
}

export async function executeTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>
): Promise<ToolExecutionOutcome> {
  if (!isChatbotTool(name)) {
    return {
      result: errorResult(`Ferramenta desconhecida: ${name}`),
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
          return {
            result: needsInputResult(["full_name"], "Preciso do nome completo do paciente."),
          };
        }
        const res = await registerPatientViaAssistant(supabase, clinicId, {
          full_name: fullName,
          phone: phoneNumber,
          email: args.email ? String(args.email) : null,
        });
        if (res.error) {
          await logToolCall(supabase, clinicId, conversationId, name, args, res.error, false);
          return { result: errorResult(res.error) };
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

      case "update_patient_intake": {
        const patientId = String(args.patient_id ?? ctx.aiState.patient_id ?? "");
        if (!patientId) {
          return {
            result: needsInputResult(["patient_id"], "Paciente não identificado."),
          };
        }

        const intakeFields: Record<string, unknown> = {};
        if (args.cpf) {
          const normalized = normalizeCpf(args.cpf);
          if (!normalized) {
            return {
              result: errorResult("CPF inválido. Informe 11 dígitos."),
              mutationOutcome: "business",
            };
          }
          intakeFields.cpf = normalized;
        }
        if (args.email) intakeFields.email = args.email;
        if (args.insurance) intakeFields.insurance = args.insurance;
        if (args.payment_method) intakeFields.payment_method = args.payment_method;
        if (args.guardian) intakeFields.guardian = args.guardian;
        if (args.cancel_reason) intakeFields.cancel_reason = args.cancel_reason;
        if (args.custom_fields && typeof args.custom_fields === "object") {
          for (const [k, v] of Object.entries(args.custom_fields as Record<string, unknown>)) {
            intakeFields[`custom:${k}`] = v;
          }
        }

        if (Object.keys(intakeFields).length === 0) {
          return {
            result: needsInputResult([], "Informe ao menos um campo para atualizar."),
          };
        }

        const res = await updatePatientIntakeViaAssistant(
          supabase,
          clinicId,
          patientId,
          intakeFields
        );
        if (!res.ok) {
          const outcome = outcomeFromServiceError(res.error);
          await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "err", false);
          return {
            result: errorResult(res.error ?? "Erro ao atualizar dados."),
            mutationOutcome: outcome,
          };
        }

        const prevCollected = ctx.aiState.conversation_flow?.collected ?? {};
        const collected = { ...prevCollected, ...intakeFields };

        await logToolCall(supabase, clinicId, conversationId, name, args, "ok", true);
        return {
          result: successResult({ updated: true, fields: Object.keys(intakeFields) }),
          mutationOutcome: "success",
          entities: { patient: patientId },
          statePatch: {
            conversation_flow: {
              ...(ctx.aiState.conversation_flow ?? {
                active_workflow_id: "consulta",
                mode: "assisted",
                satisfied: [],
                pending: [],
              }),
              collected,
            },
          },
        };
      }

      case "list_doctors": {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, specialty")
          .eq("clinic_id", clinicId)
          .eq("role", "medico")
          .order("full_name");
        const doctors = data ?? [];
        const options = buildDoctorOptions(doctors);
        await logToolCall(supabase, clinicId, conversationId, name, {}, `${doctors.length} médicos`, true);
        return {
          result: successResult({ doctors }, options),
          statePatch: {
            offered_doctors: options.map((o) => ({
              id: o.id,
              name: o.label,
              index: o.index!,
            })),
          },
        };
      }

      case "list_procedures": {
        const doctorId =
          resolveBookingEntityId({
            arg: args.doctor_id,
            stateId: ctx.aiState.booking?.doctor_id,
            offered: ctx.aiState.offered_doctors,
            rejectId: ctx.aiState.patient_id,
          }) || null;
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
            return {
              result: unavailableResult(
                "Nenhum procedimento disponível para este médico.",
                "Liste médicos ou procedimentos sem filtro."
              ),
            };
          }
          query = query.in("id", procedureIds);
        }
        const { data } = await query;
        const procedures = data ?? [];
        const options = buildProcedureOptions(procedures);
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          { doctor_id: doctorId },
          `${procedures.length} procedimentos`,
          true
        );
        return {
          result: successResult({ procedures }, options),
          statePatch: {
            offered_procedures: options.map((o) => ({
              id: o.id,
              name: o.label,
              index: o.index!,
            })),
            ...(doctorId
              ? {
                  booking: {
                    ...ctx.aiState.booking,
                    doctor_id: doctorId,
                    status: ctx.aiState.booking?.status ?? "collecting",
                  },
                }
              : {}),
          },
        };
      }

      case "find_available_slots": {
        const doctorId = resolveBookingEntityId({
          arg: args.doctor_id,
          stateId: ctx.aiState.booking?.doctor_id,
          offered: ctx.aiState.offered_doctors,
          rejectId: ctx.aiState.patient_id,
        });
        const procedureId = resolveBookingEntityId({
          arg: args.procedure_id,
          stateId: ctx.aiState.booking?.procedure_id,
          offered: ctx.aiState.offered_procedures,
          rejectId: ctx.aiState.patient_id,
        });
        if (!doctorId) {
          return {
            result: needsInputResult(["doctor_id"], "Preciso do médico antes de buscar horários."),
          };
        }
        if (!procedureId) {
          return {
            result: needsInputResult(["procedure_id"], "Preciso do procedimento antes de buscar horários."),
          };
        }

        const daysAhead = Number(args.days_ahead) || 14;
        const period = normalizeSlotPeriod(args.period);
        const skipDays = Number(args.skip_days) || 0;

        const hasDateArg = args.date != null && String(args.date).trim() !== "";
        let date: string | undefined;
        if (hasDateArg) {
          const resolvedDate = resolveBookingDate({
            dateArg: args.date,
            offeredDays: ctx.aiState.offered_days,
            bookingDate: ctx.aiState.booking?.date,
            clinicTimezone: DEFAULT_CLINIC_TIMEZONE,
          });
          if (!resolvedDate.ok) {
            const reason = resolvedDate.reason;
            const message = resolveBookingDateFailureMessage(reason);
            const dayOptions: ToolOption[] | undefined = ctx.aiState.offered_days?.length
              ? ctx.aiState.offered_days.map((d, i) => ({
                  id: d.date,
                  label: d.label,
                  index: d.index ?? i + 1,
                }))
              : undefined;
            await logToolCall(
              supabase,
              clinicId,
              conversationId,
              name,
              args,
              `date rejected: ${reason}`,
              false,
              "needs_input",
              reason
            );
            return {
              result: needsInputResult(["date"], message, dayOptions),
            };
          }
          date = resolvedDate.date;
        }

        const loggedArgs = date ? { ...args, date } : args;

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
            await logToolCall(supabase, clinicId, conversationId, name, loggedArgs, "par inválido", false);
            return {
              result: unavailableResult(
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

          if (slots.length === 0) {
            const periodLabel = period === "manha" ? "manhã" : period === "tarde" ? "tarde" : "";
            const periodPart = periodLabel ? ` no período da ${periodLabel}` : "";
            await logToolCall(supabase, clinicId, conversationId, name, loggedArgs, "0 horários", true);
            return {
              result: unavailableResult(
                `Não há horários disponíveis em ${date}${periodPart}.`,
                availablePeriods.length
                  ? `Turnos disponíveis neste dia: ${availablePeriods.map(formatSlotPeriodLabel).join(", ")}.`
                  : "Buscar outros dias sem filtro de data ou com skip_days.",
                {
                  mode: "times",
                  date,
                  period: period ?? null,
                  available_periods: availablePeriods.map(formatSlotPeriodLabel),
                }
              ),
              statePatch: {
                booking: {
                  procedure_id: procedureId,
                  doctor_id: doctorId,
                  date,
                  status: "collecting",
                },
              },
            };
          }

          const slotOptions: ToolOption[] = slots.map((s, i) => ({
            id: s.scheduled_at,
            label: s.label,
            index: i + 1,
          }));
          const payload = {
            mode: "times" as const,
            date,
            period: period ?? null,
            slots,
            available_periods: availablePeriods.map(formatSlotPeriodLabel),
          };
          await logToolCall(
            supabase,
            clinicId,
            conversationId,
            name,
            loggedArgs,
            `${slots.length} horários`,
            true
          );
          return {
            result: successResult(payload, slotOptions),
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

        if (daysForDisplay.length === 0) {
          await logToolCall(supabase, clinicId, conversationId, name, loggedArgs, "0 dias", true);
          return {
            result: unavailableResult(
              "Não há dias disponíveis no período buscado.",
              hasMore
                ? `Tente skip_days=${skipDays + 1} para ver dias seguintes.`
                : "Tente outro médico ou procedimento.",
              { mode: "days", has_more: hasMore, skip_days_used: skipDays }
            ),
            statePatch: {
              booking: {
                procedure_id: procedureId,
                doctor_id: doctorId,
                status: "collecting",
              },
            },
          };
        }

        const dayOptions: ToolOption[] = daysForDisplay.map((d, i) => ({
          id: d.date,
          label: `${d.label}${d.periods_label ? ` (${d.periods_label})` : ""}`,
          index: i + 1,
        }));
        const payload = {
          mode: "days" as const,
          days: daysForDisplay,
          has_more: hasMore,
          skip_days_used: skipDays,
          next_skip_days: skipDays + days.length,
        };
        await logToolCall(supabase, clinicId, conversationId, name, loggedArgs, `${days.length} dias`, true, "success");
        return {
          result: successResult(payload, dayOptions),
          statePatch: {
            offered_days: daysForDisplay.map((d, i) => ({
              date: d.date,
              label: d.label,
              index: i + 1,
            })),
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
        const flowConfig = ctx.flowConfig ?? mergeClinicFlowConfig({});
        const registry = buildGoalRegistry(ctx.customFields);
        const workflow =
          getWorkflowFromConfig(
            flowConfig.conversationFlows,
            ctx.aiState.conversation_flow?.active_workflow_id ?? "consulta"
          ) ?? DEFAULT_WORKFLOW_CONSULTA;
        const flowState = ctx.aiState.conversation_flow ?? {
          active_workflow_id: workflow.id,
          mode: workflow.mode,
          satisfied: [],
          pending: [],
          collected: {},
        };
        const engineInput = {
          workflow,
          policy: flowConfig.appointmentPolicy,
          registry,
          aiState: ctx.aiState,
          flowState,
        };
        const pendencies = computePendencies(engineInput);

        const scheduledAt = resolveCreateAppointmentScheduledAt(args, ctx.aiState);

        const res = await createAppointmentViaAssistant(supabase, {
          clinicId,
          patientId: String(args.patient_id ?? ctx.aiState.patient_id),
          doctorId: String(args.doctor_id ?? ctx.aiState.booking?.doctor_id),
          procedureId: String(args.procedure_id ?? ctx.aiState.booking?.procedure_id),
          scheduledAt,
          dimensionValueIds: [],
          offeredSlots,
          intakePendencies: pendencies,
        });

        if (!res.ok) {
          await logToolCall(
            supabase,
            clinicId,
            conversationId,
            name,
            args,
            res.error,
            false
          );

          // Domain conflict → runtime refetches slots (service does not own UX lists).
          if (res.conflict) {
            const date =
              ctx.aiState.booking?.date ??
              (scheduledAt ? String(scheduledAt).slice(0, 10) : undefined);
            const doctorId = String(args.doctor_id ?? ctx.aiState.booking?.doctor_id ?? "");
            const procedureId = String(
              args.procedure_id ?? ctx.aiState.booking?.procedure_id ?? ""
            );
            if (date && doctorId && procedureId) {
              const slots = await findSlotsForDay(supabase, {
                clinicId,
                doctorId,
                procedureId,
                date,
                patientId: ctx.aiState.patient_id ?? null,
              });
              const slotOptions: ToolOption[] = slots.map((s, i) => ({
                id: s.scheduled_at,
                label: s.label,
                index: i + 1,
              }));
                return {
                  result: {
                    ...unavailableResult(
                      res.conflict.message,
                      slots.length
                        ? "Escolha outro horário da lista atualizada."
                        : "Não há outros horários neste dia. Peça outro dia.",
                      {
                        conflict: true,
                        date,
                        slots,
                      }
                    ),
                    options: slotOptions.length ? slotOptions : undefined,
                  },
                  mutationOutcome: outcomeFromServiceError(res.error),
                  statePatch: {
                    booking: {
                      procedure_id: procedureId,
                      doctor_id: doctorId,
                      date,
                      offered_slots: slots.map((s) => ({
                        scheduled_at: s.scheduled_at,
                        display: s.label,
                      })),
                      pending_slot: undefined,
                      status: "collecting",
                    },
                  },
                };
            }
          }

          return {
            result: errorResult(res.error),
            mutationOutcome: outcomeFromServiceError(res.error),
          };
        }

        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          args,
          res.appointmentId,
          true
        );
        const closedFlow = completeCurrentOperation({
          workflow,
          flowState,
          mutationSucceeded: true,
          complete: true,
        });
        const synced = syncFlowState({
          ...engineInput,
          flowState: closedFlow,
          aiState: {
            ...ctx.aiState,
            booking: undefined,
            focused_appointment_id: res.appointmentId,
            active_appointments: [res.appointmentId],
            conversation_flow: closedFlow,
          },
        });
        const whenLabel = scheduledAt
          ? formatWhenLabel(String(scheduledAt))
          : undefined;
        return {
          result: successResult(
            {
              appointment_id: res.appointmentId,
              created: true,
              intake_pendencies: pendencies,
              action: "create" as const,
              whenLabel,
            },
            undefined,
            { renderStrategy: "mutation_success" }
          ),
          mutationOutcome: "success",
          entities: {
            appointment: res.appointmentId,
            patient: String(args.patient_id ?? ctx.aiState.patient_id),
          },
          statePatch: {
            booking: undefined,
            focused_appointment_id: res.appointmentId,
            active_appointments: [res.appointmentId],
            conversation_flow: synced,
          },
        };
      }

      case "list_patient_appointments": {
        const patient =
          ctx.aiState.patient_id != null
            ? { id: ctx.aiState.patient_id }
            : await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient?.id) {
          return {
            result: errorResult("Paciente não cadastrado."),
          };
        }
        const listed = await listCancellableAppointmentsWithPhoneFallback(supabase, {
          clinicId,
          patientId: patient.id,
          phone: phoneNumber,
          upcomingOnly: !args.include_past,
        });
        const appointments = listed.appointments;
        const listExecutionTrace = listed.listExecutionTrace;
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          { ...args, _listExecutionTrace: listExecutionTrace },
          `${appointments.length} consultas${listed.usedPhoneFallback ? " (phone fallback)" : ""}`,
          true
        );
        const ids = appointments.map((a) => a.id).filter(Boolean) as string[];
        // appointments[i] ↔ option i+1 — same order for presentation and selection.
        const options: ToolOption[] = appointments.map((a, i) => ({
          id: a.id,
          label: [a.procedure_name, a.doctor_name, a.scheduled_at].filter(Boolean).join(" — ") || `Consulta ${i + 1}`,
          index: i + 1,
        }));
        const listMode = resolveAppointmentListRenderMode(ctx.aiState);
        const focusedId = focusedAfterAppointmentListRefresh(
          ids,
          ctx.aiState.focused_appointment_id
        );
        const focusedRow = focusedId
          ? appointments.find((a) => a.id === focusedId)
          : undefined;
        const hydratePatch =
          focusedRow != null
            ? hydrateBookingFromAppointment(
                {
                  id: focusedRow.id,
                  doctor_id: focusedRow.doctor_id,
                  procedure_id: focusedRow.procedure_id,
                },
                ctx.aiState
              )
            : { focused_appointment_id: focusedId };

        return {
          result: successResult(
            { appointments, renderMode: listMode },
            options.length >= 1 ? options : undefined,
            { renderStrategy: "appointment_list", renderMode: listMode }
          ),
          statePatch: {
            patient_id: listed.resolvedPatientId,
            active_appointments: ids,
            ...hydratePatch,
          },
          listExecutionTrace,
        };
      }

      case "cancel_appointment": {
        const patient =
          ctx.aiState.patient_id != null
            ? { id: ctx.aiState.patient_id }
            : await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient?.id) return { result: errorResult("Paciente não encontrado.") };

        const { resolveCancelAppointmentId, cancelAppointmentIdFailureMessage } =
          await import("../state/resolve-cancel-appointment-id");
        const resolvedId = resolveCancelAppointmentId(args, {
          ...ctx.aiState,
          patient_id: patient.id,
        });
        if (!resolvedId.ok) {
          return {
            result: needsInputResult(
              ["appointment_id"],
              cancelAppointmentIdFailureMessage(resolvedId.reason)
            ),
          };
        }
        const appointmentId = resolvedId.appointmentId;
        const reason = args.cancellation_reason === "reschedule" ? "reschedule" : "other";

        if (reason === "reschedule") {
          const { data: apptRow } = await supabase
            .from("appointments")
            .select("id, doctor_id, procedure_id")
            .eq("id", appointmentId)
            .eq("clinic_id", clinicId)
            .maybeSingle();
          const hydrated = hydrateBookingFromAppointment(
            {
              id: appointmentId,
              doctor_id: apptRow?.doctor_id,
              procedure_id: apptRow?.procedure_id,
            },
            ctx.aiState
          );
          const flowConfig = ctx.flowConfig ?? mergeClinicFlowConfig({});
          const rescheduleWf =
            getWorkflowFromConfig(flowConfig.conversationFlows, "reschedule") ??
            DEFAULT_WORKFLOW_REMARCACAO;
          await logToolCall(supabase, clinicId, conversationId, name, args, "fluxo remarcação", true);
          return {
            result: successResult({
              reschedule_flow: true,
              appointment_id: appointmentId,
            }),
            statePatch: {
              ...hydrated,
              conversation_flow: {
                ...(ctx.aiState.conversation_flow ?? {
                  active_workflow_id: rescheduleWf.id,
                  mode: rescheduleWf.mode,
                  satisfied: [],
                  pending: [],
                  collected: {},
                }),
                active_workflow_id: rescheduleWf.id,
                mode: rescheduleWf.mode,
              },
            },
          };
        }

        // Owner of the appointment row (may differ from state after phone-fallback list).
        let cancelPatientId = patient.id;
        const { data: apptOwner } = await supabase
          .from("appointments")
          .select("patient_id, status")
          .eq("id", appointmentId)
          .eq("clinic_id", clinicId)
          .maybeSingle();
        if (apptOwner?.patient_id) {
          cancelPatientId = String(apptOwner.patient_id);
        }

        const res = await cancelAppointmentViaAssistant(
          supabase,
          clinicId,
          appointmentId,
          cancelPatientId
        );
        await logToolCall(supabase, clinicId, conversationId, name, args, res.error ?? "cancelada", !res.error);
        if (res.error) {
          // Domain error → invalidate invalid focus, reopen list path (cancel contract).
          return {
            result: errorResult(
              `${res.error} Chame list_patient_appointments para listar as consultas canceláveis.`
            ),
            statePatch: {
              focused_appointment_id: undefined,
              active_appointments: undefined,
            },
          };
        }
        const flowState = ctx.aiState.conversation_flow;
        const prevActive = (ctx.aiState.active_appointments ?? [])
          .map((id) => String(id).trim())
          .filter(Boolean);
        const remaining = prevActive.filter((id) => id !== appointmentId);

        if (!flowState) {
          return {
            result: successResult(
              {
                cancelled: true,
                appointment_id: appointmentId,
                action: "cancel" as const,
              },
              undefined,
              { renderStrategy: "mutation_success" }
            ),
            statePatch: {
              focused_appointment_id: undefined,
              active_appointments: remaining,
            },
          };
        }

        const flowConfig = ctx.flowConfig ?? mergeClinicFlowConfig({});
        const cancelWf =
          getWorkflowFromConfig(flowConfig.conversationFlows, flowState.active_workflow_id) ??
          DEFAULT_WORKFLOW_CANCELAMENTO;

        return {
          result: successResult(
            {
              cancelled: true,
              appointment_id: appointmentId,
              action: "cancel" as const,
              ...(remaining.length > 0 ? { remaining_count: remaining.length } : {}),
            },
            undefined,
            remaining.length === 0 ? { renderStrategy: "mutation_success" } : undefined
          ),
          statePatch: {
            focused_appointment_id: undefined,
            active_appointments: remaining,
            conversation_flow: completeCurrentOperation({
              workflow: cancelWf,
              flowState,
              mutationSucceeded: true,
              remainingTargets: remaining,
            }),
          },
        };
      }

      case "reschedule_appointment": {
        const patient =
          ctx.aiState.patient_id != null
            ? { id: ctx.aiState.patient_id }
            : await lookupPatientByPhone(supabase, clinicId, phoneNumber);
        if (!patient?.id) return { result: errorResult("Paciente não encontrado.") };

        const { resolveCancelAppointmentId, cancelAppointmentIdFailureMessage } =
          await import("../state/resolve-cancel-appointment-id");
        const resolvedId = resolveCancelAppointmentId(args, {
          ...ctx.aiState,
          patient_id: patient.id,
        });
        if (!resolvedId.ok) {
          return {
            result: needsInputResult(
              ["appointment_id"],
              cancelAppointmentIdFailureMessage(resolvedId.reason)
            ),
          };
        }
        const appointmentId = resolvedId.appointmentId;
        const newScheduledAt =
          resolveCreateAppointmentScheduledAt(
            { ...args, scheduled_at: args.new_scheduled_at },
            ctx.aiState
          ) || String(args.new_scheduled_at ?? "");
        if (!newScheduledAt) {
          return {
            result: needsInputResult(
              ["new_scheduled_at"],
              "Preciso do novo horário (scheduled_at de find_available_slots)."
            ),
          };
        }

        let reschedulePatientId = patient.id;
        const { data: apptRow } = await supabase
          .from("appointments")
          .select("patient_id, doctor_id, procedure_id, status")
          .eq("id", appointmentId)
          .eq("clinic_id", clinicId)
          .maybeSingle();
        if (apptRow?.patient_id) {
          reschedulePatientId = String(apptRow.patient_id);
        }

        const res = await rescheduleAppointmentViaAssistant(supabase, {
          clinicId,
          appointmentId,
          patientId: reschedulePatientId,
          newScheduledAt,
        });
        await logToolCall(
          supabase,
          clinicId,
          conversationId,
          name,
          args,
          res.error ?? "remarcada",
          !res.error
        );
        if (res.error) {
          return {
            result: errorResult(
              `${res.error} Chame list_patient_appointments para listar as consultas remarcáveis.`
            ),
            statePatch: {
              focused_appointment_id: undefined,
              active_appointments: undefined,
            },
          };
        }

        const flowState = ctx.aiState.conversation_flow;
        const whenLabel = formatWhenLabel(newScheduledAt);
        const successData = {
          rescheduled: true,
          appointment_id: appointmentId,
          action: "reschedule" as const,
          whenLabel,
        };

        if (!flowState) {
          return {
            result: successResult(successData, undefined, {
              renderStrategy: "mutation_success",
            }),
            statePatch: {
              focused_appointment_id: appointmentId,
              active_appointments: [appointmentId],
              booking: undefined,
            },
          };
        }

        const flowConfig = ctx.flowConfig ?? mergeClinicFlowConfig({});
        const rescheduleWf =
          getWorkflowFromConfig(flowConfig.conversationFlows, flowState.active_workflow_id) ??
          DEFAULT_WORKFLOW_REMARCACAO;

        const closedFlow = completeCurrentOperation({
          workflow: rescheduleWf,
          flowState,
          mutationSucceeded: true,
          complete: true,
        });

        return {
          result: successResult(successData, undefined, {
            renderStrategy: "mutation_success",
          }),
          statePatch: {
            focused_appointment_id: appointmentId,
            active_appointments: [appointmentId],
            booking: undefined,
            conversation_flow: closedFlow,
          },
        };
      }

      case "get_service_price": {
        const doctorId = args.doctor_id
          ? String(args.doctor_id)
          : ctx.aiState.booking?.doctor_id;
        if (!doctorId) {
          return {
            result: needsInputResult(["doctor_id"], "Preciso do médico para consultar o preço."),
          };
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
            result: needsInputResult(
              ["procedure_id"],
              "Preciso do procedimento para consultar o preço."
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
        if (price.error) return { result: errorResult(price.error) };
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
          return {
            result: needsInputResult(["query"], "Preciso saber o que o paciente quer saber."),
          };
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
            result: notFoundResult(
              "Não encontrei essa informação nas perguntas frequentes.",
              "Tente list_procedures para serviços ou get_service_price para valores."
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
        return { result: errorResult(`Ferramenta não implementada: ${name}`) };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logToolCall(supabase, clinicId, conversationId, name, args, message, false);
    return { result: errorResult(message) };
  }
}
