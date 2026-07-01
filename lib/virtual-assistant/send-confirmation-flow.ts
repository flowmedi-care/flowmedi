import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVariableContext } from "@/lib/message-variables";
import { getMetaTemplateParams } from "@/lib/whatsapp-meta-templates";
import { checkWhatsAppIntegration, sendWhatsAppFlowTemplate } from "@/lib/comunicacao/whatsapp";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";
import { encodeConfirmationFlowToken } from "./confirmation-flow-token";
import { getConfirmationFlowConfig } from "./confirmation-flow-config";

async function loadConfirmationTemplateContext(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  appointmentId: string
) {
  const [{ data: patient }, { data: clinic }, { data: appointmentData }] = await Promise.all([
    supabase
      .from("patients")
      .select("full_name, email, phone, birth_date")
      .eq("id", patientId)
      .single(),
    supabase
      .from("clinics")
      .select("name, phone, email, address, whatsapp_url, facebook_url, instagram_url")
      .eq("id", clinicId)
      .single(),
    supabase
      .from("appointments")
      .select(
        `
        scheduled_at,
        status,
        recommendations,
        doctor:profiles!appointments_doctor_id_fkey(full_name),
        procedure:procedures!procedure_id(name)
      `
      )
      .eq("id", appointmentId)
      .single(),
  ]);

  const doctor = appointmentData?.doctor as { full_name?: string } | { full_name?: string }[] | null;
  const procedure = appointmentData?.procedure as { name?: string } | { name?: string }[] | null;

  return {
    context: await buildVariableContext({
      patient: patient ?? undefined,
      clinic: clinic ?? undefined,
      appointment: appointmentData
        ? {
            scheduled_at: appointmentData.scheduled_at,
            status: appointmentData.status,
            recommendations: appointmentData.recommendations,
          }
        : undefined,
      doctor: Array.isArray(doctor) ? doctor[0] : doctor ?? undefined,
      procedure: Array.isArray(procedure) ? procedure[0] : procedure ?? undefined,
    }),
    appointmentData,
    doctor: Array.isArray(doctor) ? doctor[0] : doctor,
    procedure: Array.isArray(procedure) ? procedure[0] : procedure,
  };
}

export async function sendConfirmationFlowTemplate(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    phoneNumber: string;
    patientId: string;
    appointmentId: string;
    eventCode: string;
    customPhrase?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const flowConfig = await getConfirmationFlowConfig(supabase, opts.clinicId);
  if (!flowConfig) {
    return { success: false, error: "Flow de confirmação não configurado" };
  }

  const integration = await checkWhatsAppIntegration(opts.clinicId, false, supabase);
  if (!integration.connected) {
    return { success: false, error: integration.error ?? "WhatsApp não conectado" };
  }

  const { context, appointmentData, doctor, procedure } = await loadConfirmationTemplateContext(
    supabase,
    opts.clinicId,
    opts.patientId,
    opts.appointmentId
  );
  const meta = getMetaTemplateParams(opts.eventCode, context, opts.customPhrase);
  const bodyParams = meta?.params ?? [
    context.paciente?.nome ?? "Paciente",
    "Confirme sua consulta pelo botão abaixo.",
  ];

  const dt = appointmentData?.scheduled_at ? new Date(appointmentData.scheduled_at) : null;
  const dateLabel = dt
    ? dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })
    : "";
  const timeLabel = dt
    ? dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  const flowToken = encodeConfirmationFlowToken({
    c: opts.clinicId,
    a: opts.appointmentId,
    p: opts.patientId,
  });

  const to = normalizeWhatsAppPhone(opts.phoneNumber.replace(/\D/g, ""));
  const result = await sendWhatsAppFlowTemplate(
    opts.clinicId,
    {
      to,
      templateName: flowConfig.templateName,
      flowId: flowConfig.flowId,
      flowToken,
      bodyParams,
      flowActionData: {
        appointment_id: opts.appointmentId,
        patient_id: opts.patientId,
        clinic_id: opts.clinicId,
        data_consulta: dateLabel,
        hora_consulta: timeLabel,
        medico: doctor?.full_name ?? "",
        procedimento: procedure?.name ?? "",
      },
    },
    supabase
  );

  if (result.success) {
    await supabase.from("whatsapp_messages").insert({
      conversation_id: opts.conversationId,
      clinic_id: opts.clinicId,
      direction: "outbound",
      message_type: "template_flow",
      content: `[flow:${flowConfig.templateName}] ${bodyParams.join(" | ")}`,
      sent_at: new Date().toISOString(),
      ai_processed_at: new Date().toISOString(),
    } as Record<string, unknown>);
  }

  return { success: result.success, error: result.error };
}
