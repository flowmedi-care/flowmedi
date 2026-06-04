import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, Bell } from "lucide-react";

export async function AdminTodayStrip({ clinicId }: { clinicId: string }) {
  const supabase = await createClient();
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const [{ count: appointmentsToday }, pendingResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .not("status", "eq", "cancelada"),
    supabase.rpc("get_pending_events", {
      p_clinic_id: clinicId,
      p_patient_id: null,
      p_event_code: null,
      p_limit: 100,
      p_offset: 0,
      p_secretary_id: null,
    }),
  ]);

  const pendingEvents = Array.isArray(pendingResult.data) ? pendingResult.data.length : 0;

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Operação de hoje</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {appointmentsToday ?? 0} consulta(s) agendada(s) hoje · {pendingEvents} evento(s)
            pendente(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/atendimento"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <CalendarClock className="h-4 w-4" />
            Fila operacional
          </Link>
          <Link
            href="/dashboard/eventos"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Bell className="h-4 w-4" />
            Central de Eventos
          </Link>
          <Link
            href="/dashboard/consulta?preset=operacional"
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Lista operacional
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
