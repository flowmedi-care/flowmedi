"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAppointment } from "../../actions";
import { Calendar, X } from "lucide-react";

function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function DataHoraReagendar({
  scheduledAt,
  appointmentId,
  canEdit,
}: {
  scheduledAt: string;
  appointmentId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showPopup, setShowPopup] = useState(false);
  const [date, setDate] = useState(() => toLocalDateInput(scheduledAt));
  const [time, setTime] = useState(() => toLocalTimeInput(scheduledAt));
  const [updating, setUpdating] = useState(false);

  const formatted = new Date(scheduledAt).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUpdating(true);
    const localDate = new Date(`${date}T${time}:00`);
    const res = await updateAppointment(appointmentId, {
      scheduled_at: localDate.toISOString(),
    });
    setUpdating(false);
    if (!res.error) {
      setShowPopup(false);
      router.refresh();
    }
  }

  return (
    <>
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Data/hora:</span>{" "}
        <span>{formatted}</span>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPopup(true)}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Reagendar
          </Button>
        )}
      </p>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/10"
            onClick={() => setShowPopup(false)}
            aria-hidden
          />
          <div className="relative bg-white border border-gray-200 rounded-lg shadow-xl max-w-sm w-full p-4 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Reagendar</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPopup(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-900">Nova data</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="bg-white text-gray-900 border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-900">Novo horário</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="bg-white text-gray-900 border-gray-300"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={updating} className="flex-1">
                  {updating ? "Salvando…" : "Salvar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPopup(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
