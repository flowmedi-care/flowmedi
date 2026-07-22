"use server";

import { createClient } from "@/lib/supabase/server";
import { loadOperationalProjection } from "@/lib/operational-journey";
import type { OperationalProjection } from "@/lib/operational-journey";

export async function getOperationalDashboard(): Promise<{
  data: OperationalProjection | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { data: null, error: "Sem clínica." };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { data: null, error: "Sem permissão." };
  }

  try {
    const data = await loadOperationalProjection(supabase, profile.clinic_id);
    return { data, error: null };
  } catch (e) {
    console.error("[getOperationalDashboard]", e);
    return { data: null, error: "Falha ao carregar o dia." };
  }
}
