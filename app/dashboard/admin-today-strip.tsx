import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Bell, List, Calendar } from "lucide-react";

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
    <Card variant="flat" className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold">Operação de hoje</p>
              <div className="mt-2 flex flex-wrap gap-4">
                <div>
                  <p className="text-2xl font-bold tabular-nums">{appointmentsToday ?? 0}</p>
                  <p className="text-xs text-muted-foreground">consultas agendadas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{pendingEvents}</p>
                  <p className="text-xs text-muted-foreground">eventos pendentes</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" size="sm" asChild>
              <Link href="/dashboard/pendencias">
                <List className="h-4 w-4" />
                Pendências
              </Link>
            </Button>
            <Button variant="soft" size="sm" asChild>
              <Link href="/dashboard/atendimento">
                <CalendarClock className="h-4 w-4" />
                Fila do dia
              </Link>
            </Button>
            <Button variant="soft" size="sm" asChild>
              <Link href="/dashboard/eventos">
                <Bell className="h-4 w-4" />
                Central de Eventos
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/consulta?preset=operacional">
                <List className="h-4 w-4" />
                Lista de consultas
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
