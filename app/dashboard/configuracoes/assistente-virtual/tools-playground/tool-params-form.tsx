"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  getPlaygroundParamMeta,
  getNestedValue,
} from "@/lib/virtual-assistant/tools/playground-metadata";
import type { PlaygroundCatalog } from "@/lib/virtual-assistant/tools/playground-catalog";
import type { JsonSchemaProperty } from "./utils";
import { PatientPicker } from "./entity-pickers/patient-picker";
import {
  DoctorPicker,
  ProcedurePicker,
  ServicePicker,
} from "./entity-pickers/catalog-pickers";
import {
  AppointmentPicker,
  DimensionValuesPicker,
  type AppointmentOption,
} from "./entity-pickers/appointment-picker";
import type { PhoneContext } from "./hooks/use-playground-catalog";

type Props = {
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  formValues: Record<string, string>;
  onFormChange: (values: Record<string, string>) => void;
  catalog: PlaygroundCatalog | null;
  phoneContext: PhoneContext | null;
  aiState: Record<string, unknown>;
};

function inferValue(
  paramName: string,
  inferFrom: string[] | undefined,
  phoneContext: PhoneContext | null,
  aiState: Record<string, unknown>
): string | undefined {
  if (!inferFrom?.length) return undefined;
  for (const source of inferFrom) {
    if (source === "phone" && phoneContext?.patient?.id) return phoneContext.patient.id;
    if (source === "context.appointments" && phoneContext?.appointments[0]?.id) {
      return phoneContext.appointments[0].id;
    }
    if (source.startsWith("aiState.")) {
      const path = source.replace("aiState.", "");
      const val = getNestedValue(aiState, path);
      if (val != null && val !== "") return String(val);
    }
  }
  return undefined;
}

function ParamField({
  paramName,
  schema,
  required,
  value,
  onChange,
  catalog,
  phoneContext,
  aiState,
  allFormValues,
}: {
  paramName: string;
  schema: JsonSchemaProperty;
  required: boolean;
  value: string;
  onChange: (v: string) => void;
  catalog: PlaygroundCatalog | null;
  phoneContext: PhoneContext | null;
  aiState: Record<string, unknown>;
  allFormValues: Record<string, string>;
}) {
  const meta = getPlaygroundParamMeta(paramName, schema.description);
  const inferred = inferValue(paramName, meta.inferFrom, phoneContext, aiState);
  const fromContext = inferred && !value && inferred;

  function applyInferred() {
    if (inferred) onChange(inferred);
  }

  const id = `param-${paramName}`;

  let input: React.ReactNode;

  if (meta.entity === "patient" || paramName === "patient_id") {
    input = <PatientPicker valueId={value} onChangeId={onChange} label="" />;
  } else if (meta.entity === "doctor" || paramName === "doctor_id") {
    input = <DoctorPicker catalog={catalog} valueId={value} onChangeId={onChange} label="" />;
  } else if (meta.entity === "procedure" || paramName === "procedure_id") {
    input = (
      <ProcedurePicker
        catalog={catalog}
        valueId={value}
        onChangeId={onChange}
        doctorId={allFormValues.doctor_id}
        label=""
      />
    );
  } else if (meta.entity === "appointment" || paramName === "appointment_id") {
    input = (
      <AppointmentPicker
        appointments={(phoneContext?.appointments ?? []) as AppointmentOption[]}
        valueId={value}
        onChangeId={onChange}
        label=""
      />
    );
  } else if (meta.entity === "service" || paramName === "service_id") {
    input = <ServicePicker catalog={catalog} valueId={value} onChangeId={onChange} label="" />;
  } else if (paramName === "dimension_value_ids") {
    const ids = value
      ? value.startsWith("[")
        ? (JSON.parse(value) as string[])
        : value.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    input = (
      <DimensionValuesPicker
        dimensions={catalog?.pricingDimensions ?? []}
        values={catalog?.pricingDimensionValues ?? []}
        selectedIds={ids}
        onChange={(next) => onChange(JSON.stringify(next))}
        label=""
      />
    );
  } else if (schema.type === "boolean") {
    input = (
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </Select>
    );
  } else if (schema.enum?.length) {
    input = (
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {schema.enum.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </Select>
    );
  } else if (meta.widget === "datetime-iso" || paramName === "scheduled_at" || paramName === "new_scheduled_at") {
    const pendingSlot = getNestedValue(aiState, "booking.pending_slot");
    const pendingSlotStr =
      pendingSlot != null && pendingSlot !== "" ? String(pendingSlot) : null;
    const offeredSlots = getNestedValue(aiState, "booking.offered_slots") as
      | Array<{ scheduled_at: string; display?: string }>
      | undefined;
    input = (
      <div className="space-y-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={meta.example ?? "2026-08-15T14:30:00-03:00"}
        />
        <div className="flex flex-wrap gap-1">
          {pendingSlotStr && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChange(pendingSlotStr)}>
              Usar slot pendente
            </Button>
          )}
          {offeredSlots?.slice(0, 3).map((slot) => (
            <Button
              key={slot.scheduled_at}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onChange(slot.scheduled_at)}
            >
              {slot.display ?? slot.scheduled_at}
            </Button>
          ))}
        </div>
      </div>
    );
  } else if (meta.widget === "date" || paramName === "date") {
    input = (
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else if (schema.type === "number") {
    input = (
      <Input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else if (schema.type === "array") {
    input = (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='["uuid-1"] ou uuid-1, uuid-2'
      />
    );
  } else {
    input = (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={meta.example}
      />
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {meta.label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        <code className="text-[10px] text-muted-foreground">{paramName}</code>
        {fromContext && (
          <Badge variant="secondary" className="text-[10px]">
            ← do contexto
          </Badge>
        )}
        {fromContext && (
          <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={applyInferred}>
            Aplicar
          </Button>
        )}
      </div>
      {input}
      {meta.description && (
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      )}
      {meta.example && (
        <p className="text-[10px] text-muted-foreground/80">
          Exemplo: <code>{meta.example}</code>
        </p>
      )}
    </div>
  );
}

export function ToolParamsForm({
  properties,
  required,
  formValues,
  onFormChange,
  catalog,
  phoneContext,
  aiState,
}: Props) {
  const keys = Object.keys(properties);
  if (!keys.length) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Esta ferramenta não exige parâmetros — usa o telefone e o estado da conversa.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Parâmetros da ferramenta</p>
      {keys.map((key) => (
        <ParamField
          key={key}
          paramName={key}
          schema={properties[key]!}
          required={required.includes(key)}
          value={formValues[key] ?? ""}
          onChange={(v) => onFormChange({ ...formValues, [key]: v })}
          catalog={catalog}
          phoneContext={phoneContext}
          aiState={aiState}
          allFormValues={formValues}
        />
      ))}
    </div>
  );
}
