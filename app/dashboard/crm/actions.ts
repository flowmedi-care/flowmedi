"use server";

import { createClient } from "@/lib/supabase/server";

export async function getConsultationFunnel(periodDays = 30) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: null };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão.", data: null };
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("status")
    .eq("clinic_id", profile.clinic_id)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  const total = appointments?.length ?? 0;
  const realizadas = (appointments ?? []).filter((a) => a.status === "realizada").length;
  const confirmadas = (appointments ?? []).filter(
    (a) => a.status === "confirmada" || a.status === "realizada" || a.status === "falta"
  ).length;
  const faltas = (appointments ?? []).filter((a) => a.status === "falta").length;
  const canceladas = (appointments ?? []).filter((a) => a.status === "cancelada").length;

  return {
    error: null,
    data: {
      agendadas: total,
      confirmadas,
      compareceram: realizadas,
      noShow: faltas,
      canceladas,
      taxaConfirmacao: total > 0 ? Math.round((confirmadas / total) * 100) : 0,
      taxaComparecimento: total > 0 ? Math.round((realizadas / total) * 100) : 0,
      periodDays,
    },
  };
}
