"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listWaitlistEntries,
  cancelWaitlistEntry,
  type WaitlistEntry,
} from "./waitlist-actions";
import { toast } from "@/components/ui/toast";
import type { DoctorOption } from "./agenda-client";

export function AgendaWaitlistPanel({
  defaultDate,
  doctors,
}: {
  defaultDate: string;
  doctors: DoctorOption[];
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listWaitlistEntries(defaultDate).then((res) => {
      setLoading(false);
      if (res.error) toast(res.error, "error");
      else setEntries(res.entries);
    });
  }, [open, defaultDate]);

  async function handleCancel(id: string) {
    const res = await cancelWaitlistEntry(id);
    if (res.error) toast(res.error, "error");
    else {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast("Entrada removida da fila.", "success");
    }
  }

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm">Fila de espera</h2>
          <p className="text-xs text-muted-foreground">
            Pacientes aguardando vaga no dia selecionado na agenda.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Ocultar" : "Ver fila"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum paciente na fila para esta data.</p>
          ) : (
            entries.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{e.patientName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {doctors.find((d) => d.id === e.doctorId)?.full_name ?? "Médico"}
                  </span>
                  {(e.preferredTimeStart || e.preferredTimeEnd) && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {e.preferredTimeStart?.slice(0, 5) ?? "—"} –{" "}
                      {e.preferredTimeEnd?.slice(0, 5) ?? "—"}
                    </Badge>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleCancel(e.id)}>
                  Remover
                </Button>
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}
