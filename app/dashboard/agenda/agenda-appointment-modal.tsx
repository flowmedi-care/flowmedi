"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import { Check, FileText, X } from "lucide-react";
import {
  createAppointment,
  updateAppointment,
  getPublicFormTemplatesForPatient,
  getAppointmentForEdit,
  getAppointmentChargePreview,
  type AppointmentChargePreview,
} from "./actions";
import { createRecurringAppointments } from "./recurrence-actions";
import {
  AppointmentDateTimeRecurrence,
  defaultRecurrenceForm,
  type RecurrenceFormState,
} from "./appointment-datetime-recurrence";
import { buildRecurrenceSessionSlots } from "@/lib/recurrence-schedule";
import { recurrenceBillingModeLabel, type ServiceRecurrenceBillingMode } from "@/lib/recurrence-billing";
import { getServiceRecurrenceBilling } from "@/app/dashboard/servicos-valores/actions";
import {
  buildScheduledEndAt,
  plannedDurationMinutes,
  suggestDefaultEndTimeHm,
} from "@/lib/appointment-scheduling";
import { createWaitlistEntry } from "./waitlist-actions";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import {
  POLICY_HINT,
  POLICY_LABEL,
} from "./consulta/[id]/check-in-payment-policy";
import type { PaymentPolicy } from "./encounter-actions";
import { suggestDurationMinutesFromProcedures } from "@/lib/procedure-scheduling";
import type {
  PatientOption,
  DoctorOption,
  RoomOption,
  ProcedureOption,
  FormTemplateOption,
  ServiceOption,
  PricingDimensionOption,
  PricingDimensionValueOption,
  ServicePriceRuleOption,
  DoctorProcedureLink,
} from "./agenda-client";

export type AppointmentFormState = {
  patientId: string;
  doctorId: string;
  procedureIds: string[];
  serviceId: string;
  dimensionSelections: Record<string, string>;
  linkedFormTemplateIds: string[];
  date: string;
  time: string;
  endTime: string;
  roomId: string;
  notes: string;
  recommendations: string;
  requiresFasting: boolean;
  requiresMedicationStop: boolean;
  specialInstructions: string;
  preparationNotes: string;
  paymentPolicy: PaymentPolicy;
};

const WIZARD_STEPS = [
  { step: 1, label: "Dados básicos" },
  { step: 2, label: "Procedimentos" },
  { step: 3, label: "Data e hora" },
  { step: 4, label: "Financeiro" },
] as const;

export function AgendaAppointmentModal({
  open,
  onOpenChange,
  onSuccess,
  mode = "create",
  appointmentId = null,
  initialForm,
  patients,
  doctors,
  procedures,
  formTemplates,
  services,
  pricingDimensions,
  pricingDimensionValues,
  servicePriceRules,
  doctorProcedures,
  rooms = [],
  roomsRequired = false,
  userRole = "secretaria",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (appointmentId?: string) => void;
  mode?: "create" | "edit";
  appointmentId?: string | null;
  initialForm?: Partial<AppointmentFormState>;
  patients: PatientOption[];
  doctors: DoctorOption[];
  procedures: ProcedureOption[];
  formTemplates: FormTemplateOption[];
  services: ServiceOption[];
  pricingDimensions: PricingDimensionOption[];
  pricingDimensionValues: PricingDimensionValueOption[];
  servicePriceRules: ServicePriceRuleOption[];
  doctorProcedures: DoctorProcedureLink[];
  rooms?: RoomOption[];
  roomsRequired?: boolean;
  userRole?: string;
}) {
  const router = useRouter();
  const isEdit = mode === "edit" && !!appointmentId;
  const canSeeRecurrenceBilling =
    userRole === "admin" || userRole === "secretaria";
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedValor, setResolvedValor] = useState<number | null>(null);
  const [chargePreview, setChargePreview] = useState<AppointmentChargePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [publicFormTemplates, setPublicFormTemplates] = useState<{ id: string; name: string }[]>([]);
  const [selectedFormTemplateId, setSelectedFormTemplateId] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceFormState>(defaultRecurrenceForm);
  const [recurrenceConflictCount, setRecurrenceConflictCount] = useState(0);
  const [serviceRecurrenceMode, setServiceRecurrenceMode] =
    useState<ServiceRecurrenceBillingMode>(null);
  const [serviceRecurrenceName, setServiceRecurrenceName] = useState<string | null>(null);
  const [addingToWaitlist, setAddingToWaitlist] = useState(false);
  const [treatmentPlanId, setTreatmentPlanId] = useState<string | null>(null);

  const defaultForm = (): AppointmentFormState => ({
    patientId: "",
    doctorId: "",
    procedureIds: [],
    serviceId: "",
    dimensionSelections: {},
    linkedFormTemplateIds: [],
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    endTime: "09:30",
    roomId: rooms.length === 1 ? rooms[0].id : "",
    notes: "",
    recommendations: "",
    requiresFasting: false,
    requiresMedicationStop: false,
    specialInstructions: "",
    preparationNotes: "",
    paymentPolicy: "no_dia",
  });

  const [form, setForm] = useState<AppointmentFormState>(defaultForm);

  const effectiveServiceId = useMemo(
    () => form.serviceId || chargePreview?.linkedServiceId || null,
    [form.serviceId, chargePreview?.linkedServiceId]
  );

  const recurrenceSessionCount = Math.min(
    52,
    Math.max(2, recurrence.sessionCount)
  );

  useEffect(() => {
    if (!open) return;
    setStep(1);
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
          procedureIds: d.procedureIds,
          serviceId: d.serviceId,
          dimensionSelections: d.dimensionSelections,
          date: d.date,
          time: d.time,
          endTime: d.endTime,
          roomId: d.roomId,
          notes: d.notes,
          recommendations: d.recommendations,
          requiresFasting: d.requiresFasting,
          requiresMedicationStop: d.requiresMedicationStop,
          specialInstructions: d.specialInstructions,
          preparationNotes: d.preparationNotes,
          paymentPolicy: d.paymentPolicy ?? "no_dia",
        });
        setResolvedValor(d.valor);
        setTreatmentPlanId(d.treatmentPlanId);
      });
      return;
    }

    setTreatmentPlanId(null);
    setForm({ ...defaultForm(), ...initialForm });
    setResolvedValor(null);
    setRecurrence(defaultRecurrenceForm());
  }, [open, initialForm, isEdit, appointmentId]);

  const doctorProceduresByDoctor = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const link of doctorProcedures) {
      if (!map[link.doctorId]) map[link.doctorId] = new Set();
      map[link.doctorId].add(link.procedureId);
    }
    return map;
  }, [doctorProcedures]);

  const doctorProcedureFilterActive = useMemo(() => {
    if (!form.doctorId || !doctorProcedures.length) return false;
    const allowed = doctorProceduresByDoctor[form.doctorId];
    return !!allowed && allowed.size > 0;
  }, [form.doctorId, doctorProcedures.length, doctorProceduresByDoctor]);

  const availableProcedures = useMemo(() => {
    if (!form.doctorId) return procedures;
    if (!doctorProcedures.length) return procedures;
    const allowed = doctorProceduresByDoctor[form.doctorId];
    // Sem vínculo médico↔procedimento: mostra todos (não esconder a lista)
    if (!allowed || allowed.size === 0) return procedures;
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
    if (!open || !form.doctorId) {
      setChargePreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    const dimensionValueIds = Object.values(form.dimensionSelections).filter(Boolean);
    getAppointmentChargePreview(
      form.procedureIds,
      form.doctorId,
      form.serviceId || null,
      dimensionValueIds
    ).then((res) => {
      if (cancelled) return;
      setLoadingPreview(false);
      if (res.error || !res.data) {
        setChargePreview(null);
        return;
      }
      setChargePreview(res.data);
      setResolvedValor(res.data.totalAmount);
      if (!form.serviceId && res.data.linkedServiceId) {
        setForm((f) => ({ ...f, serviceId: res.data!.linkedServiceId! }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, form.procedureIds, form.serviceId, form.doctorId, form.dimensionSelections]);

  useEffect(() => {
    if (!open || !recurrence.enabled || !effectiveServiceId || !canSeeRecurrenceBilling) {
      setServiceRecurrenceMode(null);
      setServiceRecurrenceName(null);
      return;
    }
    let cancelled = false;
    getServiceRecurrenceBilling(effectiveServiceId).then((res) => {
      if (cancelled) return;
      if (!res.error) {
        setServiceRecurrenceMode(res.mode);
        setServiceRecurrenceName(res.serviceName);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, recurrence.enabled, effectiveServiceId, canSeeRecurrenceBilling]);

  useEffect(() => {
    if (isEdit || !form.procedureIds.length) return;
    const mins = suggestDurationMinutesFromProcedures(form.procedureIds, procedures);
    setForm((f) => ({
      ...f,
      endTime: suggestDefaultEndTimeHm(f.time || "09:00", mins),
    }));
  }, [form.procedureIds, form.time, procedures, isEdit]);

  const plannedMinutesPreview = useMemo(() => {
    if (!form.date || !form.time || !form.endTime) return null;
    const start = new Date(`${form.date}T${form.time}:00`).toISOString();
    const end = buildScheduledEndAt(form.date, form.endTime, start);
    return plannedDurationMinutes(start, end);
  }, [form.date, form.time, form.endTime]);

  const linkedFormTemplates = useMemo(
    () =>
      form.linkedFormTemplateIds
        .map((id) => formTemplates.find((t) => t.id === id))
        .filter((t): t is FormTemplateOption => !!t),
    [form.linkedFormTemplateIds, formTemplates]
  );

  const availableFormTemplates = useMemo(
    () => formTemplates.filter((t) => !form.linkedFormTemplateIds.includes(t.id)),
    [formTemplates, form.linkedFormTemplateIds]
  );

  async function addToWaitlistFromForm() {
    if (!form.patientId || !form.doctorId || !form.date) {
      setError("Preencha paciente, profissional e data antes de entrar na fila.");
      return;
    }
    setAddingToWaitlist(true);
    const res = await createWaitlistEntry({
      patientId: form.patientId,
      doctorId: form.doctorId,
      preferredDate: form.date,
      preferredTimeStart: form.time || null,
      preferredTimeEnd: form.endTime || null,
      procedureId: form.procedureIds[0] ?? null,
      roomId: form.roomId || null,
    });
    setAddingToWaitlist(false);
    if (res.error) setError(res.error);
    else {
      toast("Paciente adicionado à fila de espera.", "success");
      onOpenChange(false);
    }
  }

  function validateStep(currentStep: number): string | null {
    if (currentStep === 1) {
      if (!form.patientId || !form.doctorId) {
        return "Paciente e profissional são obrigatórios.";
      }
      if (roomsRequired && !form.roomId) {
        return "Selecione a sala/consultório.";
      }
    }
    if (currentStep === 2 && !form.procedureIds.length) {
      return "Selecione pelo menos um procedimento.";
    }
    if (currentStep === 3) {
      if (!form.date || !form.time || !form.endTime) {
        return "Informe data e horários de início e término.";
      }
      if (
        !isEdit &&
        recurrence.enabled &&
        recurrenceConflictCount > 0 &&
        !recurrence.forceConflict
      ) {
        return "Uma ou mais sessões estão em conflito. Ajuste os horários ou marque forçar agendamento (admin).";
      }
    }
    return null;
  }

  function goNext() {
    const stepError = validateStep(step);
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(null);
    if (step < WIZARD_STEPS.length) setStep(step + 1);
  }

  function goPrev() {
    setError(null);
    if (step > 1) setStep(step - 1);
  }

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
      const mins = suggestDurationMinutesFromProcedures(procedureIds, procedures);
      return {
        ...f,
        procedureIds,
        recommendations: recommendations || f.recommendations,
        serviceId: serviceId || f.serviceId,
        endTime: suggestDefaultEndTimeHm(f.time || "09:00", mins),
      };
    });
  };

  async function handleSubmit() {
    setError(null);
    if (!form.patientId || !form.doctorId) {
      setError("Paciente e profissional são obrigatórios.");
      setStep(1);
      return;
    }
    if (!form.procedureIds.length) {
      setError("Selecione pelo menos um procedimento (aba Procedimentos).");
      setStep(2);
      return;
    }
    const dimensionValueIds = Object.values(form.dimensionSelections).filter(Boolean);
    const previewRes = await getAppointmentChargePreview(
      form.procedureIds,
      form.doctorId,
      form.serviceId || null,
      dimensionValueIds
    );
    const effectiveServiceIdSubmit =
      form.serviceId || previewRes.data?.linkedServiceId || null;
    const recurrenceActive = !isEdit && recurrence.enabled;

    let billingModeForRecurrence: ServiceRecurrenceBillingMode = null;
    if (recurrenceActive && effectiveServiceIdSubmit) {
      const svcRes = await getServiceRecurrenceBilling(effectiveServiceIdSubmit);
      if (svcRes.error) {
        setError(svcRes.error);
        return;
      }
      billingModeForRecurrence = svcRes.mode;
    }

    const needsService =
      !recurrenceActive ||
      billingModeForRecurrence === "per_session" ||
      billingModeForRecurrence === "treatment_plan";

    if (needsService && !effectiveServiceIdSubmit) {
      setError(
        "Configure o serviço padrão no procedimento (Serviços e Valores) ou escolha o serviço na aba Financeiro."
      );
      setStep(4);
      return;
    }
    if (roomsRequired && !form.roomId) {
      setError("Selecione a sala/consultório (aba Dados).");
      setStep(1);
      return;
    }
    if (!form.endTime) {
      setError("Informe o horário de término.");
      setStep(3);
      return;
    }
    const finalValor = previewRes.data?.totalAmount ?? resolvedValor ?? null;

    setLoading(true);

    const localStart = new Date(`${form.date}T${form.time}:00`);
    const scheduledAt = localStart.toISOString();
    const scheduledEndAt = buildScheduledEndAt(form.date, form.endTime, scheduledAt);

    if (!isEdit && recurrence.enabled) {
      if (recurrenceConflictCount > 0 && !recurrence.forceConflict) {
        setError("Uma ou mais sessões estão em conflito. Ajuste os horários ou marque forçar agendamento (admin).");
        setStep(3);
        return;
      }

      const sessionCount = Math.min(52, Math.max(2, recurrence.sessionCount));
      const slots = buildRecurrenceSessionSlots(
        form.date,
        form.time,
        form.endTime,
        sessionCount,
        recurrence.frequency,
        recurrence.overrides
      );
      const procedureName =
        procedures.find((p) => form.procedureIds.includes(p.id))?.name ?? "Procedimento";

      const res = await createRecurringAppointments({
        patientId: form.patientId,
        doctorId: form.doctorId,
        appointmentTypeId: null,
        procedureIds: form.procedureIds,
        serviceId: effectiveServiceIdSubmit,
        dimensionValueIds,
        slots,
        roomId: form.roomId || null,
        notes: form.notes || null,
        recommendations: form.recommendations || null,
        specialInstructions: form.specialInstructions || null,
        preparationNotes: form.preparationNotes || null,
        linkedFormTemplateIds: form.linkedFormTemplateIds.length
          ? form.linkedFormTemplateIds
          : undefined,
        procedureNameForPlan: procedureName,
        forceConflict: recurrence.forceConflict,
      });

      setLoading(false);
      if (res.error) {
        setError(res.error);
        if (res.partialSeries && res.ids.length > 0) {
          toast(
            `Série incompleta: ${res.ids.length} consulta(s) criada(s). Revise conflitos ou cancele as sessões parciais.`,
            "error"
          );
        }
        return;
      }
      if (res.treatmentPlanId) {
        toast(
          "Plano de tratamento criado. Configure o pagamento em Planos de tratamento.",
          "success"
        );
        router.push(`/dashboard/planos-tratamento/${res.treatmentPlanId}`);
      } else {
        toast(`${res.ids.length} consultas agendadas.`, "success");
      }
      onOpenChange(false);
      onSuccess(res.ids[0]);
      return;
    }

    let createdOrEditedId: string | undefined;

    if (isEdit && appointmentId) {
      const res = await updateAppointment(appointmentId, {
        patient_id: form.patientId,
        doctor_id: form.doctorId,
        procedure_id: form.procedureIds[0] || null,
        procedure_ids: form.procedureIds,
        service_id: effectiveServiceIdSubmit,
        valor: finalValor,
        scheduled_at: scheduledAt,
        scheduled_end_at: scheduledEndAt,
        room_id: form.roomId || null,
        notes: form.notes || null,
        recommendations: form.recommendations || null,
        requires_fasting: form.requiresFasting,
        requires_medication_stop: form.requiresMedicationStop,
        special_instructions: form.specialInstructions || null,
        preparation_notes: form.preparationNotes || null,
        dimension_value_ids: dimensionValueIds,
        ...(!treatmentPlanId ? { payment_policy: form.paymentPolicy } : {}),
      });
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      createdOrEditedId = appointmentId;
    } else {
      const res = await createAppointment(
        form.patientId,
        form.doctorId,
        null,
        scheduledAt,
        form.notes || null,
        form.recommendations || null,
        form.procedureIds[0] || null,
        form.requiresFasting,
        form.requiresMedicationStop,
        form.specialInstructions || null,
        form.preparationNotes || null,
        form.linkedFormTemplateIds.length ? form.linkedFormTemplateIds : undefined,
        effectiveServiceIdSubmit,
        finalValor,
        dimensionValueIds.length ? dimensionValueIds : undefined,
        form.procedureIds,
        {
          scheduledEndAt,
          roomId: form.roomId || null,
          payment_policy: form.paymentPolicy,
        }
      );
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      createdOrEditedId = res.data?.id ? String(res.data.id) : undefined;
    }

    setLoading(false);
    onOpenChange(false);
    onSuccess(createdOrEditedId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEdit ? "Editar consulta" : "Nova consulta"}
        onClose={() => onOpenChange(false)}
        className="w-[min(42rem,calc(100vw-2rem))] max-w-none max-h-[90dvh]"
      >
        <div className="flex flex-col flex-1 min-h-0 w-full min-w-0 overflow-hidden">
          <Stepper
            value={step}
            onValueChange={(value) => {
              if (value <= step) {
                setError(null);
                setStep(value);
              }
            }}
            className="flex flex-col flex-1 min-h-0 gap-4 w-full min-w-0 overflow-hidden"
          >
            <StepperNav className="pb-4 border-b border-border shrink-0 w-full min-w-0">
              {WIZARD_STEPS.map((s, idx) => (
                <StepperItem
                  key={s.step}
                  step={s.step}
                  completed={s.step < step}
                  disabled={s.step > step}
                  className="min-w-0 flex-1"
                >
                  <StepperTrigger className="w-full min-w-0 justify-center">
                    <StepperIndicator className="shrink-0">
                      {s.step < step ? <Check className="size-3.5" /> : s.step}
                    </StepperIndicator>
                    <StepperTitle className="hidden sm:block truncate max-w-[5.5rem] md:max-w-none">
                      {s.label}
                    </StepperTitle>
                  </StepperTrigger>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <StepperSeparator className="shrink min-w-2 max-w-8" />
                  )}
                </StepperItem>
              ))}
            </StepperNav>

            {loadingEdit && (
              <p className="text-sm text-muted-foreground shrink-0">Carregando consulta…</p>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md space-y-2 shrink-0 break-words">
                <p>{error}</p>
                {!isEdit &&
                  (error.includes("já tem consulta") ||
                    error.includes("ocupada") ||
                    error.includes("simultânea")) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={addingToWaitlist}
                      onClick={addToWaitlistFromForm}
                    >
                      Adicionar à fila de espera
                    </Button>
                  )}
              </div>
            )}

            <StepperPanel className="flex-1 min-h-0 w-full min-w-0 overflow-y-auto overflow-x-hidden pr-1">
              <StepperContent value={1}>
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
                  onChange={(e) => {
                    const doctorId = e.target.value;
                    setForm((f) => {
                      let procedureIds = f.procedureIds;
                      if (doctorId && doctorProcedures.length) {
                        const allowed = doctorProceduresByDoctor[doctorId];
                        if (allowed && allowed.size > 0) {
                          procedureIds = f.procedureIds.filter((id) => allowed.has(id));
                        }
                      }
                      return { ...f, doctorId, procedureIds };
                    });
                  }}
                >
                  <option value="">Selecione</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name || d.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
            </div>
            {rooms.length > 0 && (
              <div className="space-y-2">
                <Label>
                  Sala / consultório {roomsRequired && <span className="text-destructive">*</span>}
                </Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.roomId}
                  onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                >
                  <option value="">Selecione</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
                </div>
              </StepperContent>

              <StepperContent value={2}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione um ou mais procedimentos. O sistema aplica serviço padrão, insumos (BOM) e valor total na cobrança.
            </p>
            {form.procedureIds.length === 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                Obrigatório: escolha ao menos um procedimento para vincular serviço, materiais e pagamento.
              </p>
            )}
            {doctorProcedureFilterActive && (
              <p className="text-xs text-muted-foreground">
                Exibindo apenas procedimentos vinculados a este profissional em Serviços e Valores.
              </p>
            )}
            <ul className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
              {availableProcedures.length === 0 ? (
                <li className="text-sm text-muted-foreground py-2">
                  Nenhum procedimento vinculado a este profissional. Edite o procedimento e marque os médicos que o realizam.
                </li>
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
            {chargePreview && chargePreview.materialLines.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Insumos previstos (BOM)</p>
                <ul className="text-sm space-y-0.5">
                  {chargePreview.materialLines.map((l) => (
                    <li key={l.product_id} className="flex justify-between gap-2">
                      <span>
                        {l.product_name} × {l.quantity}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {l.line_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                <p className="text-xs text-muted-foreground">
                  Formulários vinculados serão enviados ao paciente junto com a consulta.
                </p>
                {linkedFormTemplates.length > 0 && (
                  <ul className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                    {linkedFormTemplates.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FileText className="size-4 shrink-0 text-primary" />
                          <span className="truncate font-medium">{t.name}</span>
                          <Badge variant="success" className="shrink-0">
                            Vinculado
                          </Badge>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              linkedFormTemplateIds: f.linkedFormTemplateIds.filter(
                                (id) => id !== t.id
                              ),
                            }))
                          }
                          title="Remover formulário"
                        >
                          <X className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {availableFormTemplates.length > 0 ? (
                  <div className="flex gap-2">
                    <select
                      className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                      value={selectedFormTemplateId}
                      onChange={(e) => setSelectedFormTemplateId(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {availableFormTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!selectedFormTemplateId}
                      onClick={() => {
                        if (!selectedFormTemplateId) return;
                        const template = formTemplates.find(
                          (t) => t.id === selectedFormTemplateId
                        );
                        setForm((f) => ({
                          ...f,
                          linkedFormTemplateIds: f.linkedFormTemplateIds.includes(
                            selectedFormTemplateId
                          )
                            ? f.linkedFormTemplateIds
                            : [...f.linkedFormTemplateIds, selectedFormTemplateId],
                        }));
                        setSelectedFormTemplateId("");
                        if (template) {
                          toast(`Formulário "${template.name}" vinculado.`, "success");
                        }
                      }}
                    >
                      Adicionar
                    </Button>
                  </div>
                ) : linkedFormTemplates.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Todos os formulários disponíveis já foram vinculados.
                  </p>
                ) : null}
              </div>
            )}
          </div>
              </StepperContent>

              <StepperContent value={3}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Início <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  className="flex-1"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      date: e.target.value,
                    }))
                  }
                  required
                />
                <Input
                  type="time"
                  className="flex-1 max-w-[140px]"
                  step={60}
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Término <span className="text-destructive">*</span>
              </Label>
              <Input
                type="time"
                className="max-w-[140px]"
                step={60}
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                required
              />
              {plannedMinutesPreview != null && plannedMinutesPreview > 0 && (
                <p className="text-xs text-muted-foreground">
                  Duração prevista: {plannedMinutesPreview} min
                </p>
              )}
              <p className="text-xs text-muted-foreground">Fuso horário da clínica</p>
            </div>

            <AppointmentDateTimeRecurrence
              date={form.date}
              time={form.time}
              endTime={form.endTime}
              doctorId={form.doctorId}
              roomId={form.roomId || null}
              recurrence={recurrence}
              onRecurrenceChange={(patch) =>
                setRecurrence((r) => ({ ...r, ...patch }))
              }
              isEdit={isEdit}
              userRole={userRole}
              onConflictCountChange={setRecurrenceConflictCount}
            />
          </div>
              </StepperContent>

              <StepperContent value={4}>
          <div className="space-y-4">
            {!treatmentPlanId && (
              <div className="space-y-2">
                <Label>Política de pagamento</Label>
                <p className="text-xs text-muted-foreground">
                  Defina como esta consulta será cobrada.
                </p>
                <div className="flex flex-col gap-2">
                  {(Object.keys(POLICY_LABEL) as PaymentPolicy[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, paymentPolicy: key }))}
                      className={cn(
                        "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        form.paymentPolicy === key
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <span className="font-medium block">{POLICY_LABEL[key]}</span>
                      <span className="text-xs text-muted-foreground">{POLICY_HINT[key]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {treatmentPlanId && (
              <p className="text-sm text-muted-foreground rounded-lg border p-3 bg-muted/30">
                Política de pagamento definida pelo plano de tratamento vinculado.
              </p>
            )}
            {chargePreview?.linkedServiceName && !form.serviceId && (
              <p className="text-sm text-muted-foreground">
                Serviço sugerido pelo procedimento: <strong>{chargePreview.linkedServiceName}</strong>
              </p>
            )}
            <div className="space-y-2">
              <Label>Serviço (cobrança)</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.serviceId}
                onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value, dimensionSelections: {} }))}
              >
                <option value="">Detectar pelo procedimento…</option>
                {availableServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Preço vem de Serviços e Valores; materiais usam preço de venda do estoque (ou custo).
              </p>
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
            {recurrence.enabled && !isEdit && canSeeRecurrenceBilling && (
              <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
                <p className="text-sm font-semibold">Cobrança da série (definida no serviço)</p>
                {!effectiveServiceId ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Selecione ou detecte o serviço acima para ver o modelo de cobrança.
                  </p>
                ) : (
                  <>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Serviço:</span>{" "}
                      {serviceRecurrenceName ?? "—"}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Modelo:</span>{" "}
                      {recurrenceBillingModeLabel(serviceRecurrenceMode)}
                    </p>
                    {serviceRecurrenceMode == null && (
                      <p className="text-xs text-muted-foreground">
                        Configure o modelo em Serviços e Valores ou a série será agendada sem
                        valor automático.
                      </p>
                    )}
                    {chargePreview && serviceRecurrenceMode != null && (
                      <>
                        <p className="text-sm flex justify-between">
                          <span className="text-muted-foreground">Valor por sessão</span>
                          <span className="font-medium">
                            {(chargePreview.totalAmount).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </p>
                        {serviceRecurrenceMode === "treatment_plan" && (
                          <p className="text-sm flex justify-between">
                            <span className="text-muted-foreground">
                              Valor total do plano ({recurrenceSessionCount} sessões)
                            </span>
                            <span className="font-medium">
                              {(chargePreview.totalAmount * recurrenceSessionCount).toLocaleString(
                                "pt-BR",
                                { style: "currency", currency: "BRL" }
                              )}
                            </span>
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {loadingPreview && (
              <p className="text-sm text-muted-foreground">Calculando valores…</p>
            )}
            {chargePreview && !loadingPreview && (
              <div className="rounded-lg border p-4 space-y-2 bg-primary/5">
                <p className="text-sm font-semibold">
                  {recurrence.enabled && !isEdit
                    ? "Resumo por sessão (Serviços e Valores)"
                    : "Resumo da cobrança"}
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Serviço</span>
                  <span>
                    {chargePreview.serviceAmount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Materiais</span>
                  <span>
                    {chargePreview.materialsAmount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span>Total a cobrar</span>
                  <span>
                    {chargePreview.totalAmount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
                {chargePreview.warnings.map((w) => (
                  <p key={w} className="text-xs text-amber-700 dark:text-amber-400">
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
              </StepperContent>
            </StepperPanel>

            <div className="flex justify-between gap-2 pt-4 border-t shrink-0 bg-background">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <div className="flex gap-2">
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={goPrev}>
                    Anterior
                  </Button>
                )}
                {step < WIZARD_STEPS.length ? (
                  <Button type="button" onClick={goNext}>
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
          </Stepper>
        </div>
      </DialogContent>
    </Dialog>
  );
}
