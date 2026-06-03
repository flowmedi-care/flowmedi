"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createAppointment,
  updateAppointment,
  resolveAppointmentPrice,
  getPublicFormTemplatesForPatient,
  getAppointmentForEdit,
} from "./actions";
import type {
  PatientOption,
  DoctorOption,
  AppointmentTypeOption,
  ProcedureOption,
  FormTemplateOption,
  ServiceOption,
  PricingDimensionOption,
  PricingDimensionValueOption,
  ServicePriceRuleOption,
  DoctorProcedureLink,
} from "./agenda-client";

type TabId = "dados" | "procedimentos" | "data" | "financeiro";

export type AppointmentFormState = {
  patientId: string;
  doctorId: string;
  appointmentTypeId: string;
  procedureIds: string[];
  serviceId: string;
  dimensionSelections: Record<string, string>;
  linkedFormTemplateIds: string[];
  date: string;
  time: string;
  notes: string;
  recommendations: string;
  requiresFasting: boolean;
  requiresMedicationStop: boolean;
  specialInstructions: string;
  preparationNotes: string;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "dados", label: "Dados básicos" },
  { id: "procedimentos", label: "Procedimentos" },
  { id: "data", label: "Data e hora" },
  { id: "financeiro", label: "Financeiro" },
];

export function AgendaAppointmentModal({
  open,
  onOpenChange,
  onSuccess,
  mode = "create",
  appointmentId = null,
  initialForm,
  patients,
  doctors,
  appointmentTypes,
  procedures,
  formTemplates,
  services,
  pricingDimensions,
  pricingDimensionValues,
  servicePriceRules,
  doctorProcedures,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode?: "create" | "edit";
  appointmentId?: string | null;
  initialForm?: Partial<AppointmentFormState>;
  patients: PatientOption[];
  doctors: DoctorOption[];
  appointmentTypes: AppointmentTypeOption[];
  procedures: ProcedureOption[];
  formTemplates: FormTemplateOption[];
  services: ServiceOption[];
  pricingDimensions: PricingDimensionOption[];
  pricingDimensionValues: PricingDimensionValueOption[];
  servicePriceRules: ServicePriceRuleOption[];
  doctorProcedures: DoctorProcedureLink[];
}) {
  const isEdit = mode === "edit" && !!appointmentId;
  const [tab, setTab] = useState<TabId>("dados");
  const [loading, setLoading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedValor, setResolvedValor] = useState<number | null>(null);
  const [publicFormTemplates, setPublicFormTemplates] = useState<{ id: string; name: string }[]>([]);
  const [selectedFormTemplateId, setSelectedFormTemplateId] = useState("");

  const defaultForm = (): AppointmentFormState => ({
    patientId: "",
    doctorId: "",
    appointmentTypeId: "",
    procedureIds: [],
    serviceId: "",
    dimensionSelections: {},
    linkedFormTemplateIds: [],
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    notes: "",
    recommendations: "",
    requiresFasting: false,
    requiresMedicationStop: false,
    specialInstructions: "",
    preparationNotes: "",
  });

  const [form, setForm] = useState<AppointmentFormState>(defaultForm);

  useEffect(() => {
    if (!open) return;
    setTab("dados");
    setError(null);

    if (isEdit && appointmentId) {
      setLoadingEdit(true);
      getAppointmentForEdit(appointmentId).then((res) => {
        setLoadingEdit(false);
        if (res.error || !res.data) {
          setError(res.error ?? "Não foi possível carregar a consulta.");
          return;
        }
        const d = res.data;
        setForm({
          ...defaultForm(),
          patientId: d.patientId,
          doctorId: d.doctorId,
          appointmentTypeId: d.appointmentTypeId,
          procedureIds: d.procedureIds,
          serviceId: d.serviceId,
          dimensionSelections: d.dimensionSelections,
          date: d.date,
          time: d.time,
          notes: d.notes,
          recommendations: d.recommendations,
          requiresFasting: d.requiresFasting,
          requiresMedicationStop: d.requiresMedicationStop,
          specialInstructions: d.specialInstructions,
          preparationNotes: d.preparationNotes,
        });
        setResolvedValor(d.valor);
      });
      return;
    }

    setForm({ ...defaultForm(), ...initialForm });
    setResolvedValor(null);
  }, [open, initialForm, isEdit, appointmentId]);

  const doctorProceduresByDoctor = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const link of doctorProcedures) {
      if (!map[link.doctorId]) map[link.doctorId] = new Set();
      map[link.doctorId].add(link.procedureId);
    }
    return map;
  }, [doctorProcedures]);

  const availableProcedures = useMemo(() => {
    if (!form.doctorId) return procedures;
    if (!doctorProcedures.length) return procedures;
    const allowed = doctorProceduresByDoctor[form.doctorId];
    if (!allowed || allowed.size === 0) return [];
    return procedures.filter((p) => allowed.has(p.id));
  }, [form.doctorId, procedures, doctorProcedures, doctorProceduresByDoctor]);

  const servicesByDoctor = useMemo(() => {
    const global = new Set<string>();
    const byDoctor: Record<string, Set<string>> = {};
    for (const rule of servicePriceRules) {
      if (!rule.serviceId) continue;
      if (rule.professionalId) {
        if (!byDoctor[rule.professionalId]) byDoctor[rule.professionalId] = new Set();
        byDoctor[rule.professionalId].add(rule.serviceId);
      } else {
        global.add(rule.serviceId);
      }
    }
    return { global, byDoctor };
  }, [servicePriceRules]);

  const availableServices = useMemo(() => {
    if (services.length === 0) return [];
    if (!form.doctorId) return services;
    if (!servicePriceRules.length) return services;
    const { global, byDoctor } = servicesByDoctor;
    const specific = byDoctor[form.doctorId];
    if (!specific && global.size === 0) return [];
    return services.filter((s) => global.has(s.id) || specific?.has(s.id));
  }, [services, form.doctorId, servicePriceRules, servicesByDoctor]);

  useEffect(() => {
    if (!form.patientId) {
      setPublicFormTemplates([]);
      return;
    }
    getPublicFormTemplatesForPatient(form.patientId).then((res) => {
      setPublicFormTemplates(res.data ?? []);
    });
  }, [form.patientId]);

  useEffect(() => {
    if (!form.serviceId || !form.doctorId) {
      setResolvedValor(null);
      return;
    }
    const dimensionValueIds = Object.values(form.dimensionSelections).filter(Boolean);
    resolveAppointmentPrice(form.serviceId, form.doctorId, dimensionValueIds).then((res) => {
      setResolvedValor(res.valor ?? null);
    });
  }, [form.serviceId, form.doctorId, form.dimensionSelections]);

  const toggleProcedure = (id: string) => {
    setForm((f) => {
      const has = f.procedureIds.includes(id);
      const procedureIds = has ? f.procedureIds.filter((x) => x !== id) : [...f.procedureIds, id];
      const selected = procedures.filter((p) => procedureIds.includes(p.id));
      const recommendations = selected
        .map((p) => p.recommendations?.trim())
        .filter(Boolean)
        .join("\n\n");
      const first = selected[0];
      const procWithService = procedures.find(
        (p) => procedureIds.includes(p.id) && p.default_service_id
      );
      const serviceId =
        procWithService?.default_service_id ?? first?.default_service_id ?? f.serviceId;
      const appointmentTypeId =
        first?.default_appointment_type_id ?? f.appointmentTypeId;
      return {
        ...f,
        procedureIds,
        recommendations: recommendations || f.recommendations,
        serviceId: serviceId || f.serviceId,
        appointmentTypeId: appointmentTypeId || f.appointmentTypeId,
      };
    });
  };

  async function handleSubmit() {
    setError(null);
    if (!form.patientId || !form.doctorId) {
      setError("Paciente e profissional são obrigatórios.");
      setTab("dados");
      return;
    }
    setLoading(true);
    const localDate = new Date(`${form.date}T${form.time}:00`);
    const scheduledAt = localDate.toISOString();
    const dimensionValueIds = Object.values(form.dimensionSelections).filter(Boolean);

    if (isEdit && appointmentId) {
      const res = await updateAppointment(appointmentId, {
        patient_id: form.patientId,
        doctor_id: form.doctorId,
        appointment_type_id: form.appointmentTypeId || null,
        procedure_id: form.procedureIds[0] || null,
        procedure_ids: form.procedureIds,
        service_id: form.serviceId || null,
        valor: resolvedValor ?? null,
        scheduled_at: scheduledAt,
        notes: form.notes || null,
        recommendations: form.recommendations || null,
        requires_fasting: form.requiresFasting,
        requires_medication_stop: form.requiresMedicationStop,
        special_instructions: form.specialInstructions || null,
        preparation_notes: form.preparationNotes || null,
        dimension_value_ids: dimensionValueIds,
      });
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
    } else {
      const res = await createAppointment(
        form.patientId,
        form.doctorId,
        form.appointmentTypeId || null,
        scheduledAt,
        form.notes || null,
        form.recommendations || null,
        form.procedureIds[0] || null,
        form.requiresFasting,
        form.requiresMedicationStop,
        form.specialInstructions || null,
        form.preparationNotes || null,
        form.linkedFormTemplateIds.length ? form.linkedFormTemplateIds : undefined,
        form.serviceId || null,
        resolvedValor ?? null,
        dimensionValueIds.length ? dimensionValueIds : undefined,
        form.procedureIds
      );
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEdit ? "Editar consulta" : "Nova consulta"}
        onClose={() => onOpenChange(false)}
        className="max-w-2xl"
      >
        {loadingEdit && (
          <p className="text-sm text-muted-foreground mb-3">Carregando consulta…</p>
        )}
        <div className="flex gap-1 border-b border-border pb-2 mb-4 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md whitespace-nowrap",
                tab === t.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md mb-3">{error}</p>
        )}

        {tab === "dados" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Paciente *</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.patientId}
                  onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
                >
                  <option value="">Selecione</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Profissional *</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.doctorId}
                  onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value, procedureIds: [] }))}
                >
                  <option value="">Selecione</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name || d.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de consulta</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.appointmentTypeId}
                onChange={(e) => setForm((f) => ({ ...f, appointmentTypeId: e.target.value }))}
              >
                <option value="">Nenhum</option>
                {appointmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
        )}

        {tab === "procedimentos" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione um ou mais procedimentos. Recomendações e serviço padrão serão aplicados automaticamente.
            </p>
            <ul className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
              {availableProcedures.length === 0 ? (
                <li className="text-sm text-muted-foreground py-2">Nenhum procedimento disponível para este profissional.</li>
              ) : (
                availableProcedures.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.procedureIds.includes(p.id)}
                        onChange={() => toggleProcedure(p.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">{p.name}</span>
                        {p.recommendations && (
                          <span className="block text-xs text-muted-foreground line-clamp-2">{p.recommendations}</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
            <div className="space-y-2">
              <Label>Recomendações (editável)</Label>
              <Textarea
                value={form.recommendations}
                onChange={(e) => setForm((f) => ({ ...f, recommendations: e.target.value }))}
                rows={4}
              />
            </div>
            {!isEdit && formTemplates.length > 0 && (
              <div className="space-y-2">
                <Label>Vincular formulário</Label>
                <div className="flex gap-2">
                  <select
                    className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={selectedFormTemplateId}
                    onChange={(e) => setSelectedFormTemplateId(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {formTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!selectedFormTemplateId}
                    onClick={() => {
                      if (!selectedFormTemplateId) return;
                      setForm((f) => ({
                        ...f,
                        linkedFormTemplateIds: f.linkedFormTemplateIds.includes(selectedFormTemplateId)
                          ? f.linkedFormTemplateIds
                          : [...f.linkedFormTemplateIds, selectedFormTemplateId],
                      }));
                      setSelectedFormTemplateId("");
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "data" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data e hora *</Label>
              <div className="flex gap-2">
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
                <Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} required />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requiresFasting} onChange={(e) => setForm((f) => ({ ...f, requiresFasting: e.target.checked }))} />
              Jejum
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requiresMedicationStop} onChange={(e) => setForm((f) => ({ ...f, requiresMedicationStop: e.target.checked }))} />
              Suspender medicação
            </label>
          </div>
        )}

        {tab === "financeiro" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Serviço</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.serviceId}
                onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value, dimensionSelections: {} }))}
              >
                <option value="">Nenhum</option>
                {availableServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
            {pricingDimensions.map((dim) => {
              const values = pricingDimensionValues.filter((v) => v.dimension_id === dim.id);
              if (!values.length) return null;
              return (
                <div key={dim.id} className="space-y-2">
                  <Label>{dim.nome}</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.dimensionSelections[dim.id] ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dimensionSelections: { ...f.dimensionSelections, [dim.id]: e.target.value },
                      }))
                    }
                  >
                    <option value="">—</option>
                    {values.map((v) => (
                      <option key={v.id} value={v.id}>{v.nome}</option>
                    ))}
                  </select>
                </div>
              );
            })}
            {resolvedValor != null && (
              <p className="text-sm font-medium">
                Valor resolvido:{" "}
                {resolvedValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between gap-2 mt-6 pt-4 border-t">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            {tab !== "dados" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const idx = TABS.findIndex((t) => t.id === tab);
                  if (idx > 0) setTab(TABS[idx - 1].id);
                }}
              >
                Anterior
              </Button>
            )}
            {tab !== "financeiro" ? (
              <Button
                type="button"
                onClick={() => {
                  const idx = TABS.findIndex((t) => t.id === tab);
                  if (idx < TABS.length - 1) setTab(TABS[idx + 1].id);
                }}
              >
                Próximo
              </Button>
            ) : (
              <Button type="button" disabled={loading || loadingEdit} onClick={handleSubmit}>
                {loading
                  ? isEdit
                    ? "Salvando…"
                    : "Agendando…"
                  : isEdit
                    ? "Salvar alterações"
                    : "Agendar consulta"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
