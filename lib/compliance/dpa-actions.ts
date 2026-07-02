"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDpaVersion } from "@/lib/compliance/dpa";
import { insertAuditLog } from "@/lib/audit-log";

export async function recordDpaAcceptance(clinicId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.clinic_id !== clinicId || profile.role !== "admin") {
    return { error: "Sem permissão para aceitar o DPA desta clínica." };
  }

  const version = getDpaVersion();
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = hdrs.get("user-agent");

  const { error: insertError } = await supabase.from("clinic_dpa_acceptances").upsert(
    {
      clinic_id: clinicId,
      accepted_by: profile.id,
      dpa_version: version,
      accepted_at: new Date().toISOString(),
      ip_address: ip,
      user_agent: userAgent,
    },
    { onConflict: "clinic_id,dpa_version" }
  );

  if (insertError) return { error: insertError.message };

  const { error: clinicError } = await supabase
    .from("clinics")
    .update({
      accepted_dpa_at: new Date().toISOString(),
      accepted_dpa_version: version,
    })
    .eq("id", clinicId);

  if (clinicError) return { error: clinicError.message };

  await insertAuditLog(supabase, {
    clinic_id: clinicId,
    user_id: profile.id,
    action: "dpa_accepted",
    entity_type: "clinic",
    entity_id: clinicId,
    new_values: { dpa_version: version },
  });

  revalidatePath("/dashboard/configuracoes/privacidade");
  revalidatePath("/dashboard/privacidade");
  return { error: null, version };
}

export async function getClinicDpaStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { accepted: false, version: null, acceptedAt: null, currentVersion: getDpaVersion() };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { accepted: false, version: null, acceptedAt: null, currentVersion: getDpaVersion() };
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("accepted_dpa_at, accepted_dpa_version")
    .eq("id", profile.clinic_id)
    .single();

  const currentVersion = getDpaVersion();
  const accepted =
    Boolean(clinic?.accepted_dpa_version) &&
    clinic?.accepted_dpa_version === currentVersion;

  return {
    accepted,
    version: clinic?.accepted_dpa_version ?? null,
    acceptedAt: clinic?.accepted_dpa_at ?? null,
    currentVersion: getDpaVersion(),
  };
}
