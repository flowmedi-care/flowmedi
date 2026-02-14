import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TemplateEditor } from "../../template-editor";
import { getMessageTemplate, getMessageEvents } from "../../../actions";

export default async function EditarTemplatePage({
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
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const [templateResult, eventsResult] = await Promise.all([
    getMessageTemplate(id),
    getMessageEvents(),
  ]);

  const template = templateResult.data;
  const events = eventsResult.data || [];

  if (!template) {
    redirect("/dashboard/mensagens/templates");
  }

  return (
    <TemplateEditor
      templateId={template.id}
      initialEventCode={template.event_code}
      initialChannel={template.channel}
      initialName={template.name}
      initialSubject={template.subject || ""}
      initialBodyHtml={template.body_html}
      initialBodyText={template.body_text || ""}
      initialEmailHeader={template.email_header || ""}
      initialEmailFooter={template.email_footer || ""}
      events={events}
    />
  );
}
