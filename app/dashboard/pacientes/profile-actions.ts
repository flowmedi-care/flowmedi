"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  EVENT_LABELS,
  type PatientProfileBundle,
  type TimelineItem,
  type FormInstanceItem,
  type ClinicalDocItem,
  type RecommendationItem,
} from "./profile-types";

export type { PatientProfileBundle } from "./profile-types";

export async function getPatientProfileBundle(
  patientId: string
): Promise<{ error: string | null; data: PatientProfileBundle | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  const { data: patient, error: patientErr } = await supabase
    .from("patients")
    .select("id, full_name, email, phone, birth_date, cpf, notes, photo_url, custom_fields, created_at")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (patientErr || !patient) return { error: "Paciente não encontrado.", data: null };

  const { data: customFieldsRaw } = await supabase
    .from("patient_custom_fields")
    .select("id, field_name, field_label, field_type")
    .eq("clinic_id", profile.clinic_id)
    .order("display_order");

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      notes,
      recommendations,
      valor,
      doctor:profiles!doctor_id ( full_name ),
      appointment_type:appointment_types ( name ),
      procedure:procedures!procedure_id ( name ),
      appointment_procedures ( procedures!procedure_id ( name ) )
    `
    )
    .eq("patient_id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .order("scheduled_at", { ascending: false });

  const consultations = (appointments ?? []).map((a: Record<string, unknown>) => {
    const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
    const at = Array.isArray(a.appointment_type) ? a.appointment_type[0] : a.appointment_type;
    const proc = Array.isArray(a.procedure) ? a.procedure[0] : a.procedure;
    const apProcs = Array.isArray(a.appointment_procedures) ? a.appointment_procedures : [];
    const namesFromJunction = apProcs
      .map((row: Record<string, unknown>) => {
        const pr = Array.isArray(row.procedures) ? row.procedures[0] : row.procedures;
        return (pr as { name?: string })?.name;
      })
      .filter(Boolean) as string[];
    const procedure_names =
      namesFromJunction.length > 0
        ? namesFromJunction
        : proc
          ? [(proc as { name: string }).name]
          : [];

    return {
      id: String(a.id),
      scheduled_at: String(a.scheduled_at),
      status: String(a.status),
      professional_name: (doctor as { full_name?: string })?.full_name ?? null,
      appointment_type_name: (at as { name?: string })?.name ?? null,
      procedure_names,
      valor: a.valor != null ? Number(a.valor) : null,
      notes: a.notes != null ? String(a.notes) : null,
    };
  });

  const recommendations: RecommendationItem[] = (appointments ?? [])
    .filter((a: { recommendations?: string | null }) => a.recommendations?.trim())
    .map((a: Record<string, unknown>) => {
      const apProcs = Array.isArray(a.appointment_procedures) ? a.appointment_procedures : [];
      const proc = Array.isArray(a.procedure) ? a.procedure[0] : a.procedure;
      const procedure_names = apProcs.length
        ? apProcs
            .map((row: Record<string, unknown>) => {
              const pr = Array.isArray(row.procedures) ? row.procedures[0] : row.procedures;
              return (pr as { name?: string })?.name;
            })
            .filter(Boolean) as string[]
        : proc
          ? [(proc as { name: string }).name]
          : [];
      return {
        appointment_id: String(a.id),
        scheduled_at: String(a.scheduled_at),
        recommendations: String(a.recommendations),
        procedure_names,
      };
    });

  const { data: events } = await supabase
    .from("event_timeline")
    .select("id, event_code, created_at, appointment_id")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: payments } = await supabase
    .from("patient_payments")
    .select("id, amount, paid_at, payment_method")
    .eq("patient_id", patientId)
    .order("paid_at", { ascending: false });

  const { data: comandas } = await supabase
    .from("comandas")
    .select("id, total_amount, paid_amount, status, created_at, appointment_id")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  const { data: forms } = await supabase
    .from("form_instances")
    .select(
      `
      id,
      status,
      created_at,
      appointment_id,
      form_templates ( name ),
      appointments ( scheduled_at )
    `
    )
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  const { data: clinicalDocs } = await supabase
    .from("clinical_documents")
    .select(
      `
      id,
      type,
      title,
      status,
      created_at,
      appointment_id,
      doctor:profiles!doctor_id ( full_name )
    `
    )
    .eq("patient_id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  const timeline: TimelineItem[] = [];

  for (const ev of events ?? []) {
    timeline.push({
      id: `ev-${ev.id}`,
      type: "event",
      date: ev.created_at as string,
      title: EVENT_LABELS[ev.event_code as string] ?? (ev.event_code as string),
      href: ev.appointment_id ? `/dashboard/agenda/consulta/${ev.appointment_id}` : undefined,
    });
  }

  for (const c of consultations) {
    timeline.push({
      id: `ap-${c.id}`,
      type: "appointment",
      date: c.scheduled_at,
      title: `Consulta — ${c.status}`,
      subtitle: [c.professional_name, c.appointment_type_name, ...c.procedure_names]
        .filter(Boolean)
        .join(" · "),
      href: `/dashboard/agenda/consulta/${c.id}`,
    });
  }

  for (const p of payments ?? []) {
    timeline.push({
      id: `pay-${p.id}`,
      type: "payment",
      date: p.paid_at as string,
      title: `Pagamento — ${Number(p.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      subtitle: p.payment_method ? String(p.payment_method) : undefined,
    });
  }

  for (const cmd of comandas ?? []) {
    timeline.push({
      id: `cmd-${cmd.id}`,
      type: "comanda",
      date: cmd.created_at as string,
      title: `Comanda — ${cmd.status}`,
      subtitle: `Total ${Number(cmd.total_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      href: cmd.appointment_id ? `/dashboard/agenda/consulta/${cmd.appointment_id}` : undefined,
    });
  }

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = (comandas ?? [])
    .filter((c) => c.status !== "paga" && c.status !== "cancelada")
    .reduce((s, c) => s + Math.max(0, Number(c.total_amount) - Number(c.paid_amount)), 0);
  const totalBilled = (comandas ?? []).reduce((s, c) => s + Number(c.total_amount), 0);

  const formItems: FormInstanceItem[] = (forms ?? []).map((f: Record<string, unknown>) => {
    const tpl = Array.isArray(f.form_templates) ? f.form_templates[0] : f.form_templates;
    const appt = Array.isArray(f.appointments) ? f.appointments[0] : f.appointments;
    return {
      id: String(f.id),
      status: String(f.status),
      template_name: (tpl as { name?: string })?.name ?? "Formulário",
      appointment_id: f.appointment_id != null ? String(f.appointment_id) : null,
      scheduled_at: appt ? String((appt as { scheduled_at: string }).scheduled_at) : null,
      created_at: String(f.created_at),
    };
  });

  const clinicalDocuments: ClinicalDocItem[] = (clinicalDocs ?? []).map((d: Record<string, unknown>) => {
    const doc = Array.isArray(d.doctor) ? d.doctor[0] : d.doctor;
    return {
      id: String(d.id),
      type: d.type as "prescription" | "exam_request",
      title: d.title != null ? String(d.title) : null,
      status: String(d.status),
      created_at: String(d.created_at),
      appointment_id: d.appointment_id != null ? String(d.appointment_id) : null,
      doctor_name: (doc as { full_name?: string })?.full_name ?? null,
    };
  });

  return {
    error: null,
    data: {
      patient: {
        id: patient.id,
        full_name: patient.full_name,
        email: patient.email,
        phone: patient.phone,
        birth_date: patient.birth_date,
        cpf: patient.cpf,
        notes: patient.notes,
        photo_url: patient.photo_url,
        custom_fields: (patient.custom_fields as Record<string, unknown>) ?? {},
        created_at: patient.created_at,
      },
      customFields: (customFieldsRaw ?? []).map((f) => ({
        id: f.id,
        field_name: f.field_name,
        field_label: f.field_label,
        field_type: f.field_type,
      })),
      timeline,
      consultations,
      payments: (payments ?? []).map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paid_at: p.paid_at as string,
        payment_method: p.payment_method != null ? String(p.payment_method) : null,
      })),
      comandas: (comandas ?? []).map((c) => ({
        id: c.id,
        total_amount: Number(c.total_amount),
        paid_amount: Number(c.paid_amount),
        status: String(c.status),
        created_at: c.created_at as string,
      })),
      forms: formItems,
      clinicalDocuments,
      recommendations,
      financial: { totalPaid, totalDue, totalBilled },
    },
  };
}

export async function uploadPatientPhoto(patientId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const file = formData.get("file") as File | null;
  if (!file?.size) return { error: "Selecione uma imagem." };

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return { error: "Use JPG, PNG ou WEBP." };
  if (file.size > 5 * 1024 * 1024) return { error: "Imagem muito grande (máx. 5MB)." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${profile.clinic_id}/${patientId}/avatar.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage.from("patient-photos").upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadErr) {
    return {
      error: uploadErr.message.includes("Bucket not found")
        ? "Configure o bucket patient-photos no Supabase Storage."
        : uploadErr.message,
    };
  }

  const { data: urlData } = supabase.storage.from("patient-photos").getPublicUrl(path);

  const { error: updateErr } = await supabase
    .from("patients")
    .update({ photo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id);

  if (updateErr) return { error: updateErr.message };

  revalidatePath(`/dashboard/pacientes/${patientId}`);
  revalidatePath("/dashboard/pacientes");
  return { error: null, photoUrl: urlData.publicUrl };
}
