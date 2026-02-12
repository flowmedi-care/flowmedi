import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { FormularioEditor } from "../../formulario-editor";
import type { FormFieldDefinition } from "@/lib/form-types";

export default async function EditarFormularioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const { data: template } = await supabase
    .from("form_templates")
    .select("id, name, definition, appointment_type_id, is_public, public_doctor_id")
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!template) notFound();

  const { data: types } = await supabase
    .from("appointment_types")
    .select("id, name")
    .eq("clinic_id", profile.clinic_id)
    .order("name");

  const { data: doctors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", profile.clinic_id)
    .eq("role", "medico")
    .order("full_name");

  const { data: procedures } = await supabase
    .from("procedures")
    .select("id, name")
    .eq("clinic_id", profile.clinic_id)
    .order("display_order", { ascending: true });

  const { data: linkRows } = await supabase
    .from("form_template_procedures")
    .select("procedure_id")
    .eq("form_template_id", template.id);

  const initialProcedureIds = (linkRows ?? []).map((r) => r.procedure_id);

  const definition = (template.definition ?? []) as FormFieldDefinition[];

  return (
    <FormularioEditor
      templateId={template.id}
      initialName={template.name}
      initialDefinition={Array.isArray(definition) ? definition : []}
      initialAppointmentTypeId={template.appointment_type_id}
      initialProcedureIds={initialProcedureIds}
      initialIsPublic={template.is_public ?? false}
      initialPublicDoctorId={template.public_doctor_id}
      appointmentTypes={(types ?? []).map((t) => ({ id: t.id, name: t.name }))}
      procedures={(procedures ?? []).map((p) => ({ id: p.id, name: p.name }))}
      doctors={(doctors ?? []).map((d) => ({ id: d.id, full_name: d.full_name }))}
    />
  );
}
