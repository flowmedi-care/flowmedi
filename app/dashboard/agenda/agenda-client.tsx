"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { createAppointment } from "./actions";
import { Calendar, Plus, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppointmentRow = {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  patient: { id: string; full_name: string };
  doctor: { id: string; full_name: string | null };
  appointment_type: { id: string; name: string } | null;
  form_instances?: { id: string; status: string }[];
};

export type PatientOption = { id: string; full_name: string };
export type DoctorOption = { id: string; full_name: string | null };
export type AppointmentTypeOption = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
};

export function AgendaClient({
  appointments,
  patients,
  doctors,
  appointmentTypes,
}: {
  appointments: AppointmentRow[];
  patients: PatientOption[];
  doctors: DoctorOption[];
  appointmentTypes: AppointmentTypeOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    appointmentTypeId: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    notes: "",
  });

  const filtered = appointments.filter((a) => {
    const d = a.scheduled_at.slice(0, 10);
    return d === dateFilter;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const scheduledAt = `${form.date}T${form.time}:00`;
    const res = await createAppointment(
      form.patientId,
      form.doctorId,
      form.appointmentTypeId || null,
      scheduledAt,
      form.notes || null
    );
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setShowForm(false);
    setForm({
      patientId: "",
      doctorId: "",
      appointmentTypeId: "",
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",
      notes: "",
    });
    window.location.reload();
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="date_filter" className="whitespace-nowrap">
            Data
          </Label>
          <Input
            id="date_filter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          onClick={() => {
            setShowForm(true);
            if (doctors.length === 1) {
              setForm((f) => ({ ...f, doctorId: doctors[0].id }));
            }
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova consulta
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-semibold">Agendar consulta</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                  {error}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Paciente *</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.patientId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, patientId: e.target.value }))
                    }
                    required
                  >
                    <option value="">Selecione</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Médico *</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.doctorId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, doctorId: e.target.value }))
                    }
                    required
                  >
                    <option value="">Selecione</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name || d.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de consulta</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.appointmentTypeId}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        appointmentTypeId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Nenhum</option>
                    {appointmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Data e hora *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, date: e.target.value }))
                      }
                      required
                    />
                    <Input
                      type="time"
                      value={form.time}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, time: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  placeholder="Opcional"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Agendando…" : "Agendar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Consultas do dia. Clique para ver detalhes e formulários.
          </p>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhuma consulta nesta data.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered
                .sort(
                  (a, b) =>
                    new Date(a.scheduled_at).getTime() -
                    new Date(b.scheduled_at).getTime()
                )
                .map((a) => {
                  const time = new Date(a.scheduled_at).toLocaleTimeString(
                    "pt-BR",
                    { hour: "2-digit", minute: "2-digit" }
                  );
                  const pendingForms =
                    a.form_instances?.filter((f) => f.status === "pendente")
                      .length ?? 0;
                  return (
                    <li key={a.id} className="py-3 first:pt-0">
                      <Link
                        href={`/dashboard/agenda/consulta/${a.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 hover:bg-muted/50 -mx-2 px-2 py-1 rounded"
                      >
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium tabular-nums">{time}</span>
                          <span>{a.patient.full_name}</span>
                          {a.appointment_type && (
                            <span className="text-sm text-muted-foreground">
                              · {a.appointment_type.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {pendingForms > 0 && (
                            <Badge variant="secondary">
                              {pendingForms} form. pendente(s)
                            </Badge>
                          )}
                          <Badge
                            variant={
                              a.status === "realizada"
                                ? "success"
                                : a.status === "cancelada" || a.status === "falta"
                                  ? "secondary"
                                  : "default"
                            }
                          >
                            {STATUS_LABEL[a.status] ?? a.status}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
