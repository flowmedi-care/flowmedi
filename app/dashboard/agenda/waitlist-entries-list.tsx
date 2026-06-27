"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listWaitlistEntries,
  cancelWaitlistEntry,
  type WaitlistEntry,
} from "./waitlist-actions";
import { toast } from "@/components/ui/toast";
import type { DoctorOption } from "./agenda-client";

export function WaitlistEntriesList({
  active,
  defaultDate,
  doctors,
}: {
  active: boolean;
  defaultDate: string;
  doctors: DoctorOption[];
}) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadEntries = useCallback(() => {
    setLoading(true);
    listWaitlistEntries(defaultDate).then((res) => {
      setLoading(false);
      if (res.error) toast(res.error, "error");
      else setEntries(res.entries);
    });
  }, [defaultDate]);

  useEffect(() => {
    if (!active) return;
    loadEntries();
  }, [active, loadEntries]);

  async function handleCancel(id: string) {
    const res = await cancelWaitlistEntry(id);
    if (res.error) toast(res.error, "error");
    else {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast("Entrada removida da fila.", "success");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Carregando…</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nenhum paciente na fila para esta data.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-[min(50vh,24rem)] overflow-y-auto pr-1">
      {entries.map((e) => (
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
      ))}
    </div>
  );
}
