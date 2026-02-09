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
    .select("id, name, definition, appointment_type_id")
    .eq("id", id)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!template) notFound();

  const { data: types } = await supabase
    .from("appointment_types")
    .select("id, name")
    .eq("clinic_id", profile.clinic_id)
    .order("name");

  const definition = (template.definition ?? []) as FormFieldDefinition[];

  return (
    <FormularioEditor
      templateId={template.id}
      initialName={template.name}
      initialDefinition={Array.isArray(definition) ? definition : []}
      initialAppointmentTypeId={template.appointment_type_id}
      appointmentTypes={(types ?? []).map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
