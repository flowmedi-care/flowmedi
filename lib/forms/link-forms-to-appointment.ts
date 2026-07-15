import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/form-slug";
import { generateLinkToken } from "@/lib/form-link-token";

async function ensureUniqueSlug(
  supabase: SupabaseClient,
  base: string
): Promise<string> {
  let slug = base;
  let n = 0;
  while (n < 20) {
    const { data } = await supabase
      .from("form_instances")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

/** Vincula formulários do procedimento à consulta (espelha fluxo do painel). */
export async function linkFormsToAppointment(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    appointmentId: string;
    procedureId: string;
    patientEmail?: string | null;
  }
): Promise<{ linked: number }> {
  const { data: clinic } = await supabase
    .from("clinics")
    .select("slug, name")
    .eq("id", opts.clinicId)
    .single();

  let clinicSlug = clinic?.slug || slugify(clinic?.name || "clinica");
  if (!clinic?.slug) {
    await supabase.from("clinics").update({ slug: clinicSlug }).eq("id", opts.clinicId);
  }

  const { data: patient } = await supabase
    .from("appointments")
    .select("patient:patients!patient_id(full_name, email)")
    .eq("id", opts.appointmentId)
    .single();

  const patientRow = Array.isArray(patient?.patient) ? patient.patient[0] : patient?.patient;
  const patientSlug = slugify(String((patientRow as { full_name?: string })?.full_name ?? "paciente"));
  const patientEmail =
    opts.patientEmail ?? (patientRow as { email?: string | null })?.email ?? null;

  const { data: procLinks } = await supabase
    .from("form_template_procedures")
    .select("form_template_id")
    .eq("procedure_id", opts.procedureId);

  const templateIds = (procLinks ?? []).map((r) => String(r.form_template_id)).filter(Boolean);
  if (!templateIds.length) return { linked: 0 };

  const { data: existing } = await supabase
    .from("form_instances")
    .select("form_template_id")
    .eq("appointment_id", opts.appointmentId);

  const existingIds = new Set((existing ?? []).map((r) => String(r.form_template_id)));
  const toCreate = templateIds.filter((id) => !existingIds.has(id));
  if (!toCreate.length) return { linked: 0 };

  const { data: templates } = await supabase
    .from("form_templates")
    .select("id, name")
    .in("id", toCreate);

  const instances = await Promise.all(
    (templates ?? []).map(async (t) => {
      let status = "pendente";
      let responses: Record<string, unknown> = {};
      if (patientEmail) {
        const { data: publicInstance } = await supabase
          .from("form_instances")
          .select("responses, status")
          .eq("form_template_id", t.id)
          .is("appointment_id", null)
          .eq("public_submitter_email", patientEmail)
          .eq("status", "respondido")
          .maybeSingle();
        if (publicInstance?.responses) {
          status = "respondido";
          responses = (publicInstance.responses as Record<string, unknown>) || {};
        }
      }
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const formSlug = slugify(String(t.name || "formulario"));
      const combinedSlug = await ensureUniqueSlug(supabase, `${clinicSlug}/${formSlug}/${patientSlug}`);
      return {
        appointment_id: opts.appointmentId,
        form_template_id: t.id,
        status,
        link_token: generateLinkToken(),
        slug: combinedSlug,
        link_expires_at: expiresAt.toISOString(),
        responses,
      };
    })
  );

  const { error } = await supabase.from("form_instances").insert(instances);
  if (error) {
    console.error("[linkFormsToAppointment]", error);
    return { linked: 0 };
  }

  return { linked: instances.length };
}
