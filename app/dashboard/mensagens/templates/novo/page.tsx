import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TemplateEditor } from "../template-editor";
import { getMessageEvents } from "../../actions";

export default async function NovoTemplatePage() {
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

  const eventsResult = await getMessageEvents();
  const events = eventsResult.data || [];

  return (
    <TemplateEditor
      templateId={null}
      initialEventCode=""
      initialChannel="email"
      initialName=""
      initialSubject=""
      initialBodyHtml=""
      initialBodyText=""
      events={events}
    />
  );
}
