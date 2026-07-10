import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicConfig } from "../../clinic/clinic-config";
import { ToolGateway, type ToolCall, type ToolContext, type ToolExecutor } from "../gateway";
import type { ToolName } from "../registry";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function parseAssistantToolResult(result: { result: string }): {
  data: unknown;
  error?: string;
} {
  let data: unknown = result.result;
  let error: string | undefined;
  try {
    const parsed = JSON.parse(result.result) as { error?: string };
    data = parsed;
    if (parsed.error) error = parsed.error;
  } catch {
    // keep string payload
  }
  return { data, error };
}

function createExecutors(
  supabase: SupabaseClient,
  config: ClinicConfig
): Partial<Record<ToolName, ToolExecutor>> {
  return {
    checkConsent: async (_call, ctx) => {
      if (ctx.phoneNumber && ctx.clinicId) {
        const { data } = await supabase
          .from("patients")
          .select("id, consent_whatsapp_at")
          .eq("clinic_id", ctx.clinicId)
          .ilike("phone", `%${normalizePhone(ctx.phoneNumber).slice(-8)}%`)
          .limit(1)
          .maybeSingle();
        return {
          ok: true,
          data: { granted: Boolean(data?.consent_whatsapp_at), patientId: data?.id ?? null },
        };
      }
      return { ok: true, data: { granted: false, patientId: null } };
    },

    recordConsent: async (call, ctx) => {
      const patientId = (call.args.patientId as string | null) ?? null;
      if (patientId) {
        await supabase
          .from("patients")
          .update({ consent_whatsapp_at: new Date().toISOString() })
          .eq("id", patientId)
          .eq("clinic_id", ctx.clinicId);
      }
      return { ok: true, data: { recorded: true } };
    },

    findPatient: async (_call, ctx) => {
      const digits = normalizePhone(ctx.phoneNumber);
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, phone")
        .eq("clinic_id", ctx.clinicId)
        .limit(50);
      const match = (data ?? []).find((p) => {
        const pPhone = normalizePhone(String(p.phone ?? ""));
        return pPhone && digits.endsWith(pPhone.slice(-8));
      });
      return { ok: true, data: match ?? null };
    },

    createPatient: async (call, ctx) => {
      const name = String(call.args.name ?? "Paciente");
      const phone = String(call.args.phone ?? ctx.phoneNumber);
      const { data, error } = await supabase
        .from("patients")
        .insert({
          clinic_id: ctx.clinicId,
          full_name: name,
          phone,
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message, recoverable: true };
      return { ok: true, data: { id: data.id } };
    },

    listServices: async (_call, ctx) => {
      const { data: procedures } = await supabase
        .from("procedures")
        .select("id, name, default_service_id")
        .eq("clinic_id", ctx.clinicId)
        .order("name")
        .limit(30);
      return {
        ok: true,
        data: (procedures ?? []).map((p) => ({
          id: String(p.id),
          name: String(p.name),
          serviceId: p.default_service_id ? String(p.default_service_id) : null,
        })),
      };
    },

    listSlots: async (call, ctx) => {
      const { executeAssistantTool } = await import("@/lib/virtual-assistant/tools");
      const procedureId = String(call.args.procedureId ?? call.args.serviceId ?? "");
      const doctorId = call.args.doctorId ? String(call.args.doctorId) : undefined;
      const date = call.args.date ? String(call.args.date) : undefined;
      const result = await executeAssistantTool(
        {
          supabase,
          clinicId: ctx.clinicId,
          conversationId: ctx.conversationId,
          phoneNumber: ctx.phoneNumber,
          aiState: {},
          pipelineStage: "agendamento",
        },
        "find_available_slots",
        {
          procedure_id: procedureId || undefined,
          doctor_id: doctorId,
          date,
        }
      );
      const { data, error } = parseAssistantToolResult(result);
      if (error) {
        return { ok: false, error, recoverable: true };
      }
      return { ok: true, data };
    },

    createAppointment: async (call, ctx) => {
      const { createAppointmentViaAssistant } = await import(
        "@/lib/virtual-assistant/services/appointments"
      );
      const result = await createAppointmentViaAssistant(supabase, {
        clinicId: ctx.clinicId,
        patientId: String(call.args.patientId ?? ""),
        doctorId: String(call.args.professionalId ?? call.args.doctorId ?? ""),
        procedureId: String(call.args.serviceId ?? call.args.procedureId ?? ""),
        scheduledAt: String(call.args.scheduledAt ?? call.args.start ?? ""),
        serviceId: call.args.serviceId ? String(call.args.serviceId) : null,
      });
      if (result.error) return { ok: false, error: result.error, recoverable: true };
      return { ok: true, data: { appointmentId: result.appointmentId } };
    },

    cancelAppointment: async (call, ctx) => {
      const appointmentId = String(call.args.appointmentId ?? "");
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelada" })
        .eq("id", appointmentId)
        .eq("clinic_id", ctx.clinicId);
      if (error) return { ok: false, error: error.message, recoverable: true };
      return { ok: true, data: { cancelled: true } };
    },

    rescheduleAppointment: async (call, ctx) => {
      const appointmentId = String(call.args.appointmentId ?? "");
      const scheduledAt = String(call.args.scheduledAt ?? "");
      const { error } = await supabase
        .from("appointments")
        .update({ scheduled_at: scheduledAt, status: "agendada" })
        .eq("id", appointmentId)
        .eq("clinic_id", ctx.clinicId);
      if (error) return { ok: false, error: error.message, recoverable: true };
      return { ok: true, data: { rescheduled: true } };
    },

    getPriceQuote: async (call, ctx) => {
      const serviceId = String(call.args.serviceId ?? "");
      const { resolveServicePriceForClinic } = await import(
        "@/lib/virtual-assistant/services/pricing"
      );
      const price = await resolveServicePriceForClinic(
        supabase,
        ctx.clinicId,
        serviceId,
        "",
        []
      );
      return {
        ok: true,
        data: {
          amount: price?.valor ?? 0,
          currency: "BRL",
          breakdown: price?.error ?? undefined,
        },
      };
    },

    searchFaq: async (call, _ctx) => {
      const query = String(call.args.query ?? "");
      const { semanticFaqSearch } = await import("../../brain/knowledge/semantic-faq");
      const match = semanticFaqSearch(query, config.faqs);
      if (!match) {
        return { ok: true, data: null };
      }
      return {
        ok: true,
        data: { id: match.id, answer: match.answer, question: match.question },
      };
    },

    createLead: async (call, ctx) => {
      const { error } = await supabase.from("non_registered_pipeline").insert({
        clinic_id: ctx.clinicId,
        name: String(call.args.name ?? "Lead"),
        phone: String(call.args.phone ?? ctx.phoneNumber),
        email: call.args.email ? String(call.args.email) : null,
        notes: call.args.interest ? String(call.args.interest) : null,
        status: "novo",
      });
      if (error) return { ok: false, error: error.message, recoverable: true };
      return { ok: true, data: { created: true } };
    },

    openHandoffTicket: async (_call, ctx) => {
      await supabase
        .from("whatsapp_conversations")
        .update({ ai_handoff_at: new Date().toISOString() })
        .eq("id", ctx.conversationId);
      return { ok: true, data: { ticketId: `handoff-${ctx.conversationId}` } };
    },

    appendHandoffMessage: async (call, ctx) => {
      return {
        ok: true,
        data: {
          appended: true,
          text: String(call.args.text ?? ""),
          conversationId: ctx.conversationId,
        },
      };
    },
  };
}

export function createToolGateway(
  supabase: SupabaseClient,
  config: ClinicConfig
): ToolGateway {
  return new ToolGateway(createExecutors(supabase, config));
}

export function idempotencyKey(
  conversationId: string,
  turnId: string,
  toolName: ToolName
): string {
  return `${conversationId}:${turnId}:${toolName}`;
}

export type { ToolCall, ToolContext };
