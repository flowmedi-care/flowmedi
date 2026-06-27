"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createTreatmentPlan,
  generatePlanAppointments,
  listClinicDoctors,
  getDefaultServicePrice,
  listProceduresForService,
  type TreatmentPlanRow,
} from "@/app/dashboard/agenda/treatment-plan-actions";
import { buildPlanSessionDates, type PlanScheduleFrequency } from "@/lib/financeiro/plan-schedule";
import { buildScheduledEndFromDuration } from "@/lib/appointment-scheduling";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fmtCurrency } from "@/lib/financeiro/format";
import { PatientCombobox, type PatientOption } from "@/components/patient-combobox";

export function PlanosTratamentoClient({
  initialPlans,
  treatmentPlanServices = [],
}: {
  initialPlans: TreatmentPlanRow[];
  treatmentPlanServices?: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [procedures, setProcedures] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [sessions, setSessions] = useState("10");
  const [policy, setPolicy] = useState<"antecipado" | "parcelado" | "por_sessao">("antecipado");
  const [saving, setSaving] = useState(false);

  const [schedulePlanId, setSchedulePlanId] = useState<string | null>(null);
  const [firstDate, setFirstDate] = useState("");
  const [defaultTime, setDefaultTime] = useState("09:00");
  const [frequency, setFrequency] = useState<PlanScheduleFrequency>("semanal");
  const [doctorId, setDoctorId] = useState("");
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [scheduleDates, setScheduleDates] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const activePlan = initialPlans.find((p) => p.id === schedulePlanId) ?? null;
  const sessionsToSchedule = activePlan
    ? Math.max(0, activePlan.sessions_total - activePlan.sessions_used)
    : 0;

  const previewDates = useMemo(() => {
    if (!activePlan || !firstDate || frequency === "manual") return [];
    return buildPlanSessionDates(
      firstDate,
      defaultTime,
      sessionsToSchedule,
      frequency as Exclude<PlanScheduleFrequency, "manual">
    );
  }, [activePlan, firstDate, defaultTime, frequency, sessionsToSchedule]);

  useEffect(() => {
    if (schedulePlanId) {
      listClinicDoctors().then((res) => {
        if (!res.error) setDoctors(res.data);
      });
    }
  }, [schedulePlanId]);

  useEffect(() => {
    if (!serviceId) {
      setProcedures([]);
      setProcedureId("");
      return;
    }
    listProceduresForService(serviceId).then((res) => {
      if (!res.error) {
        setProcedures(res.data);
        if (res.data.length === 1) setProcedureId(res.data[0].id);
      }
    });
    getDefaultServicePrice(serviceId).then((res) => {
      if (!res.error && res.price != null && sessions) {
        const sessionCount = parseInt(sessions, 10) || 1;
        setTotal(String((res.price * sessionCount).toFixed(2).replace(".", ",")));
      }
    });
  }, [serviceId, sessions]);

  async function handleCreate() {
    if (!selectedPatient?.id || !name.trim()) {
      toast("Selecione o paciente e informe o nome do plano.", "error");
      return;
    }
    setSaving(true);
    const res = await createTreatmentPlan({
      patient_id: selectedPatient.id,
      name: name.trim(),
      total_amount: parseFloat(total.replace(",", ".")) || 0,
      sessions_total: parseInt(sessions, 10) || 1,
      payment_policy: policy,
      service_id: serviceId || null,
      procedure_id: procedureId || null,
    });
    setSaving(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Plano criado.", "success");
      router.refresh();
    }
  }

  async function handleSchedule(plan: TreatmentPlanRow) {
    if (!doctorId) {
      toast("Selecione o profissional responsável.", "error");
      return;
    }

    let slots: {
      scheduled_at: string;
      scheduled_end_at: string;
      doctor_id: string;
    }[] = [];

    if (frequency === "manual") {
      const lines = scheduleDates
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.length) {
        toast("Informe uma data/hora por linha.", "error");
        return;
      }
      slots = lines.map((scheduled_at) => {
        const iso = new Date(scheduled_at).toISOString();
        return {
          scheduled_at: iso,
          scheduled_end_at: buildScheduledEndFromDuration(iso, 30),
          doctor_id: doctorId,
        };
      });
    } else {
      if (!firstDate) {
        toast("Informe a data da primeira sessão.", "error");
        return;
      }
      if (!previewDates.length) {
        toast("Nenhuma sessão a agendar.", "error");
        return;
      }
      slots = previewDates.map((scheduled_at) => ({
        scheduled_at,
        scheduled_end_at: buildScheduledEndFromDuration(scheduled_at, 30),
        doctor_id: doctorId,
      }));
    }

    setScheduling(true);
    const res = await generatePlanAppointments(plan.id, slots);
    setScheduling(false);
    if (res.error) toast(res.error, "error");
    else {
      toast(`${res.ids?.length ?? 0} consulta(s) agendada(s).`, "success");
      setSchedulePlanId(null);
      setScheduleDates("");
      setFirstDate("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Planos ativos</h2>
        </CardHeader>
        <CardContent>
          {initialPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum plano de tratamento. Crie um pacote multi-sessão abaixo.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {initialPlans.map((p) => (
                <li key={p.id} className="py-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-muted-foreground">{p.patient_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sessões: {p.sessions_used}/{p.sessions_total}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recebido: {fmtCurrency(p.paid_amount)} / {fmtCurrency(p.total_amount)}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant="outline">{p.status}</Badge>
                    <p className="font-medium mt-1">{fmtCurrency(p.total_amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Pago: {fmtCurrency(p.paid_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sessão: {fmtCurrency(p.total_amount / Math.max(1, p.sessions_total))}
                    </p>
                    <div className="flex flex-col gap-1 mt-2">
                      <Button variant="link" size="sm" className="h-auto p-0 justify-end" asChild>
                        <Link href={`/dashboard/planos-tratamento/${p.id}`}>Ver plano</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSchedulePlanId(p.id)}
                      >
                        Gerar sessões na agenda
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {schedulePlanId && activePlan && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Gerar sessões — {activePlan.name}</h2>
            <p className="text-sm text-muted-foreground">
              {sessionsToSchedule} sessão(ões) restante(s). Conflitos de horário são avisados na
              agenda, sem bloqueio automático.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            <div className="space-y-1">
              <Label>Frequência</Label>
              <select
                className="h-9 w-full rounded-md border px-2 text-sm"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as PlanScheduleFrequency)}
              >
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
                <option value="manual">Manual (datas livres)</option>
              </select>
            </div>

            {frequency !== "manual" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Primeira sessão</Label>
                    <Input
                      type="date"
                      value={firstDate}
                      onChange={(e) => setFirstDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Horário padrão</Label>
                    <Input
                      type="time"
                      value={defaultTime}
                      onChange={(e) => setDefaultTime(e.target.value)}
                    />
                  </div>
                </div>
                {doctors.length > 0 && (
                  <div className="space-y-1">
                    <Label>Profissional responsável *</Label>
                    <select
                      className="h-9 w-full rounded-md border px-2 text-sm"
                      value={doctorId}
                      onChange={(e) => setDoctorId(e.target.value)}
                      required
                    >
                      <option value="">Selecione</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {previewDates.length > 0 && (
                  <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-1">
                    <p className="font-medium text-sm">Preview ({previewDates.length} datas)</p>
                    <ul className="max-h-40 overflow-y-auto">
                      {previewDates.map((d, i) => (
                        <li key={i}>
                          Sessão {activePlan.sessions_used + i + 1}:{" "}
                          {new Date(d).toLocaleString("pt-BR")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                {doctors.length > 0 && (
                  <div className="space-y-1">
                    <Label>Profissional responsável *</Label>
                    <select
                      className="h-9 w-full rounded-md border px-2 text-sm"
                      value={doctorId}
                      onChange={(e) => setDoctorId(e.target.value)}
                      required
                    >
                      <option value="">Selecione</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <textarea
                  className="w-full min-h-[120px] rounded-md border px-3 py-2 text-sm"
                  value={scheduleDates}
                  onChange={(e) => setScheduleDates(e.target.value)}
                  placeholder={"2026-06-10T14:00\n2026-06-17T14:00"}
                />
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSchedulePlanId(null)}>
                Cancelar
              </Button>
              <Button disabled={scheduling} onClick={() => handleSchedule(activePlan)}>
                {scheduling ? "Agendando…" : "Confirmar agendamentos"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Novo plano de tratamento</h2>
          <p className="text-sm text-muted-foreground">
            Pacote multi-sessão com política de pagamento (antecipado, parcelado ou por sessão).
          </p>
        </CardHeader>
        <CardContent className="space-y-3 max-w-lg">
          <PatientCombobox value={selectedPatient} onChange={setSelectedPatient} />
          {treatmentPlanServices.length > 0 && (
            <div className="space-y-1">
              <Label>Serviço vinculado</Label>
              <select
                className="h-9 w-full rounded-md border px-2 text-sm"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                <option value="">Selecione (opcional)</option>
                {treatmentPlanServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Serviços com modo &quot;Plano de tratamento&quot; em Serviços e valores.
              </p>
            </div>
          )}
          {procedures.length > 0 && (
            <div className="space-y-1">
              <Label>Procedimento</Label>
              <select
                className="h-9 w-full rounded-md border px-2 text-sm"
                value={procedureId}
                onChange={(e) => setProcedureId(e.target.value)}
              >
                <option value="">Selecione</option>
                {procedures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Nome do plano</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: 10 sessões laser" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Valor total (R$)</Label>
              <Input value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sessões</Label>
              <Input value={sessions} onChange={(e) => setSessions(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Política de pagamento</Label>
            <select
              className="h-9 w-full rounded-md border px-2 text-sm"
              value={policy}
              onChange={(e) => setPolicy(e.target.value as typeof policy)}
            >
              <option value="antecipado">Antecipado (à vista no plano)</option>
              <option value="parcelado">Parcelado</option>
              <option value="por_sessao">Por sessão</option>
            </select>
          </div>
          <Button onClick={handleCreate} disabled={saving}>
            Criar plano
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
