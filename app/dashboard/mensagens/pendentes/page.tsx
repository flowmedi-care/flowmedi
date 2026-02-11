import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPendingMessages } from "../actions";
import { PendentesClient } from "./pendentes-client";

export default async function PendentesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  // Secretária e Admin podem ver mensagens pendentes
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    redirect("/dashboard");
  }

  const messagesResult = await getPendingMessages();
  const messages = messagesResult.data || [];

  return <PendentesClient messages={messages} />;
}
