import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AtendimentoListClient } from "./atendimento-list-client";
import { getOperacionalRange } from "@/lib/operational-queue";

export type AtendimentoListRow = {
  id: string;
  scheduled_at: string;
  status: string;
  valor: number | null;
  patient_name: string;
  doctor_name: string | null;
  encounter_status: string | null;
  comanda_status: string | null;
};

export default async function AtendimentoListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  const clinicId = profile.clinic_id;
  const { start, end } = getOperacionalRange();

  let allowedDoctorIds: string[] = [];
  if (profile.role === "secretaria") {
    const { data: sd } = await supabase
      .from("secretary_doctors")
      .select("doctor_id")
      .eq("clinic_id", clinicId)
      .eq("secretary_id", user.id);
    allowedDoctorIds = (sd ?? []).map((r) => r.doctor_id);
  }

  let query = supabase
    .from("appointments")
    .select(
      `
      id,
      scheduled_at,
      status,
      valor,
      doctor_id,
      patient:patients ( full_name ),
      doctor:profiles!doctor_id ( full_name )
    `
    )
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString())
    .in("status", ["agendada", "confirmada", "realizada"])
    .order("scheduled_at", { ascending: true });

  if (profile.role === "medico") {
    query = query.eq("doctor_id", user.id);
  } else if (profile.role === "secretaria" && allowedDoctorIds.length > 0) {
    query = query.in("doctor_id", allowedDoctorIds);
  } else if (profile.role === "secretaria" && allowedDoctorIds.length === 0) {
    query = query.eq("doctor_id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: appointments } = await query;

  const ids = (appointments ?? []).map((a) => a.id as string);

  const encounterByAppt = new Map<string, string>();
  if (ids.length > 0) {
    const { data: encounters } = await supabase
      .from("encounters")
      .select("appointment_id, status")
      .in("appointment_id", ids);
    for (const e of encounters ?? []) {
      encounterByAppt.set(String(e.appointment_id), String(e.status));
    }
  }

  const comandaByAppt = new Map<string, string>();
  if (ids.length > 0) {
    const { data: comandas } = await supabase
      .from("comandas")
      .select("appointment_id, status")
      .in("appointment_id", ids)
      .neq("status", "cancelada");
    for (const c of comandas ?? []) {
      comandaByAppt.set(String(c.appointment_id), String(c.status));
    }
  }

  const rows: AtendimentoListRow[] = (appointments ?? []).map((a) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const doctor = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
    return {
      id: String(a.id),
      scheduled_at: String(a.scheduled_at),
      status: String(a.status),
      valor: a.valor != null ? Number(a.valor) : null,
      patient_name: (patient as { full_name?: string })?.full_name ?? "—",
      doctor_name: (doctor as { full_name?: string | null })?.full_name ?? null,
      encounter_status: encounterByAppt.get(String(a.id)) ?? null,
      comanda_status: comandaByAppt.get(String(a.id)) ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fila operacional</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consumo de material, comanda e cobrança. Consultas dos últimos 7 e próximos 14 dias.
          </p>
        </div>
        <Link
          href="/dashboard/consulta?preset=operacional"
          className="text-sm font-medium text-primary hover:underline shrink-0"
        >
          Ver na lista de consultas
        </Link>
      </div>
      <AtendimentoListClient rows={rows} />
    </div>
  );
}
