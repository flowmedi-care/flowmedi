import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveQuoteContext } from "@/lib/quotes/quote-resolution";
import { renderQuotePdfBuffer } from "@/lib/quotes/quote-pdf";
import { DEFAULT_QUOTE_TERMS } from "@/lib/quotes/types";
import { createFileAccessUrl } from "@/lib/storage/file-access-token";
import { sendAssistantReply } from "@/lib/virtual-assistant/send-reply";

const QUOTES_BUCKET = "quotes";

async function nextQuoteNumber(supabase: SupabaseClient, clinicId: string): Promise<number> {
  const { data } = await supabase
    .from("quotes")
    .select("quote_number")
    .eq("clinic_id", clinicId)
    .order("quote_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.quote_number ?? 0) + 1;
}

async function resolveRecipient(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string,
  patientId?: string
) {
  if (patientId) {
    const { data: patient } = await supabase
      .from("patients")
      .select("id, full_name, email, phone")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (patient) {
      return {
        patientId: String(patient.id),
        pipelineId: null as string | null,
        name: String(patient.full_name),
        email: patient.email ? String(patient.email) : null,
        phone: patient.phone ? String(patient.phone) : phone,
      };
    }
  }

  const normalized = phone.replace(/\D/g, "");
  const { data: leads } = await supabase
    .from("non_registered_pipeline")
    .select("id, name, email, phone")
    .eq("clinic_id", clinicId)
    .order("updated_at", { ascending: false })
    .limit(100);

  const lead = (leads ?? []).find((p) => {
    const pPhone = String(p.phone ?? "").replace(/\D/g, "");
    return pPhone && normalized.endsWith(pPhone.slice(-8));
  });

  if (lead) {
    return {
      patientId: null as string | null,
      pipelineId: String(lead.id),
      name: lead.name ? String(lead.name) : "Cliente",
      email: lead.email ? String(lead.email) : null,
      phone: lead.phone ? String(lead.phone) : phone,
    };
  }

  return {
    patientId: null,
    pipelineId: null,
    name: "Cliente",
    email: null,
    phone,
  };
}

export async function resolveQuoteOfferViaAssistant(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    procedureId: string;
    doctorId?: string | null;
  }
) {
  return resolveQuoteContext(supabase, {
    clinicId: opts.clinicId,
    procedureId: opts.procedureId,
    doctorId: opts.doctorId,
  });
}

export async function getLatestQuoteStatusForContact(
  supabase: SupabaseClient,
  clinicId: string,
  opts: { patientId?: string; pipelineId?: string; phone: string }
) {
  let query = supabase
    .from("quotes")
    .select("id, quote_number, status, total_amount, valid_until, sent_at, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (opts.patientId) query = query.eq("patient_id", opts.patientId);
  else if (opts.pipelineId) query = query.eq("pipeline_id", opts.pipelineId);
  else return { quote: null };

  const { data } = await query.maybeSingle();
  if (!data) return { quote: null };

  let status = String(data.status);
  if (
    status === "enviado" &&
    data.valid_until &&
    String(data.valid_until) < new Date().toISOString().slice(0, 10)
  ) {
    status = "expirado";
  }

  return {
    quote: {
      id: String(data.id),
      quote_number: Number(data.quote_number),
      status,
      total_amount: Number(data.total_amount),
      valid_until: data.valid_until ? String(data.valid_until) : null,
      sent_at: data.sent_at ? String(data.sent_at) : null,
    },
  };
}

export async function createAndSendQuoteViaAssistant(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    phoneNumber: string;
    procedureId: string;
    doctorId?: string | null;
    patientId?: string;
    dimensionValueIds?: string[];
  }
): Promise<{ error: string | null; quoteId?: string; summary?: string }> {
  const ctx = await resolveQuoteContext(supabase, {
    clinicId: opts.clinicId,
    procedureId: opts.procedureId,
    doctorId: opts.doctorId,
    dimensionValueIds: opts.dimensionValueIds,
  });

  if (ctx.fallbackToHuman) {
    return { error: "Não foi possível montar o orçamento. Encaminhe para a equipe." };
  }
  if (ctx.needsDoctorChoice) {
    return {
      error:
        "É necessário saber com qual médico o paciente deseja o orçamento. Use resolve_quote_offer primeiro.",
    };
  }

  const doctorId = opts.doctorId ?? ctx.autoSelectedDoctorId;
  const doctor = ctx.doctors.find((d) => d.id === doctorId) ?? ctx.doctors[0];
  if (!doctor?.price) {
    return {
      error: doctor?.needsDimensions
        ? "Preço depende de convênio ou turno. Use list_price_options antes."
        : "Preço não configurado para este procedimento/médico.",
    };
  }

  const recipient = await resolveRecipient(
    supabase,
    opts.clinicId,
    opts.phoneNumber,
    opts.patientId
  );

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, quote_default_terms")
    .eq("id", opts.clinicId)
    .single();

  const quoteNumber = await nextQuoteNumber(supabase, opts.clinicId);
  const total = doctor.price;
  const terms = clinic?.quote_default_terms
    ? String(clinic.quote_default_terms)
    : DEFAULT_QUOTE_TERMS;
  const now = new Date().toISOString();

  const { data: quote, error: insertErr } = await supabase
    .from("quotes")
    .insert({
      clinic_id: opts.clinicId,
      quote_number: quoteNumber,
      patient_id: recipient.patientId,
      pipeline_id: recipient.pipelineId,
      recipient_name: recipient.patientId ? null : recipient.name,
      recipient_phone: recipient.phone,
      recipient_email: recipient.email,
      professional_id: doctor.id,
      valid_until: ctx.validUntil,
      subtotal: total,
      discount_amount: 0,
      total_amount: total,
      terms,
      status: "enviado",
      sent_at: now,
      notes: "Gerado pelo assistente virtual",
      created_by: null,
    })
    .select("id")
    .single();

  if (insertErr || !quote) {
    return { error: insertErr?.message ?? "Erro ao criar orçamento." };
  }

  const quoteId = String(quote.id);
  const description = `${ctx.procedureName}${doctor.name ? ` — ${doctor.name}` : ""}`;

  await supabase.from("quote_items").insert({
    quote_id: quoteId,
    item_type: "service",
    reference_id: doctor.serviceId,
    description,
    quantity: 1,
    unit_price: total,
    total_price: total,
    section: "services",
    bill_separately: false,
    display_order: 0,
  });

  const receiptNumber = `ORC-${new Date().getFullYear()}-${String(quoteNumber).padStart(5, "0")}`;
  let pdfStoragePath: string | null = null;
  let pdfAccessUrl: string | null = null;

  try {
    const buffer = await renderQuotePdfBuffer({
      clinic_name: String(clinic?.name ?? "Clínica"),
      quote_number: receiptNumber,
      recipient_name: recipient.name,
      procedure_name: ctx.procedureName,
      doctor_name: doctor.name,
      total_amount: total,
      valid_until: ctx.validUntil,
      terms,
    });
    const path = `${opts.clinicId}/${quoteId}.pdf`;
    const { error: upErr } = await supabase.storage
      .from(QUOTES_BUCKET)
      .upload(path, buffer, { contentType: "application/pdf", upsert: true });
    if (!upErr) {
      pdfStoragePath = path;
      pdfAccessUrl = createFileAccessUrl(QUOTES_BUCKET, path, {
        resourceType: "quote",
        resourceId: quoteId,
      });
    }
  } catch (e) {
    console.warn("[quote-pdf]", e);
  }

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const validBr = new Date(`${ctx.validUntil}T12:00:00`).toLocaleDateString("pt-BR");
  const summary = [
    `*Orçamento ${receiptNumber}*`,
    ``,
    `Procedimento: ${ctx.procedureName}`,
    doctor.name ? `Profissional: ${doctor.name}` : null,
    `Valor: ${fmt(total)}`,
    `Válido até: ${validBr}`,
    pdfAccessUrl ? `\nPDF: ${pdfAccessUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendAssistantReply(
    supabase,
    opts.clinicId,
    opts.conversationId,
    opts.phoneNumber,
    summary
  );

  try {
    const patientIdForEvent = recipient.patientId;
    const { data: eventId } = await supabase.rpc("create_event_timeline", {
      p_clinic_id: opts.clinicId,
      p_event_code: "quote_sent",
      p_patient_id: patientIdForEvent,
      p_metadata: {
        quote_id: quoteId,
        quote_number: quoteNumber,
        total_amount: total,
        valid_until: ctx.validUntil,
        pdf_storage_path: pdfStoragePath,
        source: "virtual_assistant",
      },
    });
    if (eventId && patientIdForEvent) {
      const { runAutoSendForEvent } = await import("@/lib/event-send-logic-server");
      const { isInsideAutoMessageWindow } = await import("@/lib/whatsapp-ops-controls");
      if (await isInsideAutoMessageWindow(opts.clinicId, supabase)) {
        await runAutoSendForEvent(eventId, opts.clinicId, "quote_sent", supabase);
      }
    }
  } catch (e) {
    console.warn("[quote_sent event]", e);
  }

  return { error: null, quoteId, summary };
}
