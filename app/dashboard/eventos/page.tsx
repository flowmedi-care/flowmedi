import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPendingEvents, getPastEvents, getPatientsForFilter, getEventTypesForFilter } from "./actions";
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

  // Secretária e Admin podem ver eventos
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    redirect("/dashboard");
  }

  // Buscar dados iniciais
  const [pendingResult, pastResult, patientsResult, eventsResult] = await Promise.all([
    getPendingEvents(),
    getPastEvents(),
    getPatientsForFilter(),
    getEventTypesForFilter(),
  ]);

  const pendingEvents = pendingResult.data || [];
  const pastEvents = pastResult.data || [];
  const patients = patientsResult.data || [];
  const eventTypes = eventsResult.data || [];

  return (
    <EventosClient
      initialPendingEvents={pendingEvents}
      initialPastEvents={pastEvents}
      patients={patients}
      eventTypes={eventTypes}
    />
  );
}
