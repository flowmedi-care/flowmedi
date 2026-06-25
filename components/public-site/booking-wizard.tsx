"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CatalogDoctor = {
  id: string;
  full_name: string;
  specialty: string | null;
};

type CatalogProcedure = {
  id: string;
  name: string;
  duration_minutes: number;
  doctor_ids: string[];
};

type Slot = {
  scheduled_at: string;
  scheduled_end_at: string;
  label: string;
};

type Step = "procedure" | "doctor" | "slot" | "patient" | "confirm" | "done";

const STEPS: Step[] = ["procedure", "doctor", "slot", "patient", "confirm"];

export function BookingWizard({ slug, clinicName }: { slug: string; clinicName: string }) {
  const [step, setStep] = useState<Step>("procedure");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<CatalogDoctor[]>([]);
  const [procedures, setProcedures] = useState<CatalogProcedure[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [procedureId, setProcedureId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/booking/${slug}/catalog`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar dados.");
      setDoctors(data.doctors ?? []);
      setProcedures(data.procedures ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const filteredDoctors = procedureId
    ? doctors.filter((d) => {
        const proc = procedures.find((p) => p.id === procedureId);
        if (!proc || proc.doctor_ids.length === 0) return true;
        return proc.doctor_ids.includes(d.id);
      })
    : doctors;

  const filteredProcedures = doctorId
    ? procedures.filter((p) => {
        if (p.doctor_ids.length === 0) return true;
        return p.doctor_ids.includes(doctorId);
      })
    : procedures;

  const selectedProcedure = procedures.find((p) => p.id === procedureId);
  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  const loadSlots = async (procId: string, docId: string) => {
    setSlotsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ procedureId: procId, doctorId: docId });
      const res = await fetch(`/api/public/booking/${slug}/slots?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar horários.");
      setSlots(data.slots ?? []);
      if ((data.slots ?? []).length === 0) {
        setError("Nenhum horário disponível nos próximos dias. Tente outro profissional ou entre em contato.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar horários.");
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!procedureId || !doctorId || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/booking/${slug}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureId,
          doctorId,
          scheduledAt: selectedSlot.scheduled_at,
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao agendar.");
      setAppointmentId(data.appointmentId ?? null);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao agendar.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (step === "done") {
    return (
      <Card className="max-w-lg mx-auto rounded-3xl border-[#e8efec] shadow-lg">
        <CardContent className="pt-10 pb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold text-[#1a2e28]">Consulta agendada!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua solicitação foi registrada em {clinicName}.
            {appointmentId && " Você receberá confirmação pelos canais da clínica."}
          </p>
          <Link href={`/c/${slug}`} className="mt-6 inline-block">
            <Button variant="outline" className="rounded-full">Voltar ao site</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/c/${slug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === "procedure" && (
        <Card className="rounded-3xl border-[#e8efec] shadow-sm">
          <CardHeader>
            <CardTitle>Escolha o procedimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredProcedures.map((proc) => (
              <button
                key={proc.id}
                type="button"
                className={cn(
                  "w-full text-left rounded-2xl border border-[#e8efec] px-4 py-4 transition-all hover:border-primary/30 hover:bg-[#f7faf9]",
                  procedureId === proc.id && "border-primary bg-primary/5 shadow-sm"
                )}
                onClick={() => {
                  setProcedureId(proc.id);
                  setDoctorId(null);
                  setSelectedSlot(null);
                  setStep("doctor");
                }}
              >
                <p className="font-medium">{proc.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{proc.duration_minutes} min</p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === "doctor" && (
        <Card className="rounded-3xl border-[#e8efec] shadow-sm">
          <CardHeader>
            <CardTitle>Escolha o profissional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredDoctors.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={cn(
                  "w-full text-left rounded-2xl border border-[#e8efec] px-4 py-4 transition-all hover:border-primary/30 hover:bg-[#f7faf9]",
                  doctorId === doc.id && "border-primary bg-primary/5 shadow-sm"
                )}
                onClick={async () => {
                  setDoctorId(doc.id);
                  setSelectedSlot(null);
                  if (procedureId) {
                    setStep("slot");
                    await loadSlots(procedureId, doc.id);
                  }
                }}
              >
                <p className="font-medium">{doc.full_name}</p>
                {doc.specialty && (
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.specialty}</p>
                )}
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setStep("procedure")}>
              Voltar
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "slot" && (
        <Card className="rounded-3xl border-[#e8efec] shadow-sm">
          <CardHeader>
            <CardTitle>Escolha o horário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {slotsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              slots.map((slot) => (
                <button
                  key={slot.scheduled_at}
                  type="button"
                  className={cn(
                    "w-full text-left rounded-2xl border border-[#e8efec] px-4 py-4 transition-all hover:border-primary/30 hover:bg-[#f7faf9]",
                    selectedSlot?.scheduled_at === slot.scheduled_at && "border-primary bg-primary/5 shadow-sm"
                  )}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setStep("patient");
                  }}
                >
                  {slot.label}
                </button>
              ))
            )}
            <Button variant="ghost" size="sm" onClick={() => setStep("doctor")}>
              Voltar
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "patient" && (
        <Card className="rounded-3xl border-[#e8efec] shadow-sm">
          <CardHeader>
            <CardTitle>Seus dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone / WhatsApp *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("slot")}>
                Voltar
              </Button>
              <Button
                className="flex-1"
                disabled={!fullName.trim() || !phone.trim()}
                onClick={() => setStep("confirm")}
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "confirm" && selectedProcedure && selectedDoctor && selectedSlot && (
        <Card className="rounded-3xl border-[#e8efec] shadow-sm">
          <CardHeader>
            <CardTitle>Confirmar agendamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Procedimento</dt>
                <dd className="font-medium text-right">{selectedProcedure.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Profissional</dt>
                <dd className="font-medium text-right">{selectedDoctor.full_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Horário</dt>
                <dd className="font-medium text-right">{selectedSlot.label}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Paciente</dt>
                <dd className="font-medium text-right">{fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Telefone</dt>
                <dd className="font-medium text-right">{phone}</dd>
              </div>
            </dl>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("patient")} disabled={submitting}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  "Confirmar agendamento"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
