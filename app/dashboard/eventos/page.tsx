import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPendingEvents,
  getAllEvents,
  getCompletedEvents,
  getPatientsForFilter,
  getEventTypesForFilter,
  getClinicEventConfig,
} from "./actions";
import {
  getMessageEvents,
  getClinicMessageSettings,
  getMessageTemplates,
  getSystemTemplatesForDisplay,
} from "@/app/dashboard/mensagens/actions";
import { EventosClient } from "./eventos-client";

export default async function EventosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  if (profile.role !== "admin" && profile.role !== "secretaria") {
    redirect("/dashboard");
  }

  const [
    pendingResult,
    allResult,
    completedResult,
    patientsResult,
    eventsResult,
    configResult,
    msgEventsResult,
    msgSettingsResult,
    templatesResult,
    systemTemplatesResult,
  ] = await Promise.all([
    getPendingEvents(),
    getAllEvents(),
    getCompletedEvents(),
    getPatientsForFilter(),
    getEventTypesForFilter(),
    getClinicEventConfig(),
    getMessageEvents(),
    getClinicMessageSettings(),
    getMessageTemplates(),
    getSystemTemplatesForDisplay(),
  ]);

  const pendingEvents = pendingResult.data || [];
  const allEvents = allResult.data || [];
  const completedEvents = completedResult.data || [];
  const patients = patientsResult.data || [];
  const eventTypes = eventsResult.data || [];
  const eventConfig = configResult.data || [];
  const msgEvents = msgEventsResult.data || [];
  const msgSettings = msgSettingsResult.data || [];
  const templates = templatesResult.data || [];
  const systemTemplates = systemTemplatesResult.data || [];

  return (
    <EventosClient
      initialPendingEvents={pendingEvents}
      initialAllEvents={allEvents}
      initialCompletedEvents={completedEvents}
      patients={patients}
      eventTypes={eventTypes}
      eventConfig={eventConfig}
      msgEvents={msgEvents}
      msgSettings={msgSettings}
      templates={templates}
      systemTemplates={systemTemplates}
    />
  );
}
