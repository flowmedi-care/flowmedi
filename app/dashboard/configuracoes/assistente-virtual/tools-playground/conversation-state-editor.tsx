"use client";

import { useState } from "react";
import { ChevronDown, Code2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AI_STATE_SECTIONS,
  getNestedValue,
  setNestedValue,
} from "@/lib/virtual-assistant/tools/playground-metadata";
import type { PlaygroundCatalog } from "@/lib/virtual-assistant/tools/playground-catalog";
import { cn } from "@/lib/utils";
import { formatJson } from "./utils";
import {
  DoctorPicker,
  ProcedurePicker,
  ServicePicker,
} from "./entity-pickers/catalog-pickers";
import { PatientPicker } from "./entity-pickers/patient-picker";
import {
  AppointmentPicker,
  type AppointmentOption,
} from "./entity-pickers/appointment-picker";

type Props = {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  catalog: PlaygroundCatalog | null;
  appointments?: AppointmentOption[];
};

function StateField({
  fieldKey,
  fieldType,
  entity,
  enumValues,
  description,
  value,
  onChange,
  catalog,
  appointments,
}: {
  fieldKey: string;
  fieldType: string;
  entity?: string;
  enumValues?: string[];
  description?: string;
  value: unknown;
  onChange: (v: unknown) => void;
  catalog: PlaygroundCatalog | null;
  appointments?: AppointmentOption[];
}) {
  const strVal = value != null ? String(value) : "";

  if (fieldType === "entity" && entity === "patient") {
    return <PatientPicker valueId={strVal} onChangeId={(id) => onChange(id || undefined)} />;
  }
  if (fieldType === "entity" && entity === "doctor") {
    return <DoctorPicker catalog={catalog} valueId={strVal} onChangeId={(id) => onChange(id || undefined)} />;
  }
  if (fieldType === "entity" && entity === "procedure") {
    return <ProcedurePicker catalog={catalog} valueId={strVal} onChangeId={(id) => onChange(id || undefined)} />;
  }
  if (fieldType === "entity" && entity === "service") {
    return <ServicePicker catalog={catalog} valueId={strVal} onChangeId={(id) => onChange(id || undefined)} />;
  }
  if (fieldType === "entity" && entity === "appointment") {
    return (
      <AppointmentPicker
        appointments={appointments ?? []}
        valueId={strVal}
        onChangeId={(id) => onChange(id || undefined)}
      />
    );
  }
  if (fieldType === "enum" && enumValues?.length) {
    return (
      <Select value={strVal} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">—</option>
        {enumValues.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>
    );
  }
  if (fieldType === "number") {
    return (
      <Input
        type="number"
        value={strVal}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      />
    );
  }
  if (fieldType === "json") {
    return (
      <Textarea
        className="font-mono text-xs"
        rows={3}
        value={value != null ? formatJson(value) : ""}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            /* allow partial edit */
          }
        }}
      />
    );
  }

  return (
    <Input
      value={strVal}
      onChange={(e) => onChange(e.target.value || undefined)}
      placeholder={description}
    />
  );
}

export function ConversationStateEditor({ value, onChange, catalog, appointments }: Props) {
  const [rawMode, setRawMode] = useState(false);
  const [rawJson, setRawJson] = useState(formatJson(value));
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["patient", "booking"]));

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRawApply() {
    try {
      onChange(JSON.parse(rawJson) as Record<string, unknown>);
    } catch {
      /* invalid json */
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Estado da conversa</p>
          <p className="text-xs text-muted-foreground">
            Simula o aiState interno — atualizado automaticamente após cada execução.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange({});
              setRawJson("{}");
            }}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Resetar
          </Button>
          <div className="flex items-center gap-2 text-xs">
            <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span>JSON bruto</span>
            <Switch
              checked={rawMode}
              onChange={(v) => {
                setRawMode(v);
                if (v) setRawJson(formatJson(value));
              }}
            />
          </div>
        </div>
      </div>

      {rawMode ? (
        <div className="space-y-2">
          <Textarea
            className="font-mono text-xs"
            rows={8}
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
          />
          <Button type="button" size="sm" variant="secondary" onClick={handleRawApply}>
            Aplicar JSON
          </Button>
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {AI_STATE_SECTIONS.map((section) => {
            const isOpen = openSections.has(section.id);
            return (
              <div key={section.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50"
                  onClick={() => toggleSection(section.id)}
                >
                  <span>{section.label}</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="space-y-3 px-3 pb-3">
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                    {section.fields.map((field) => (
                      <div key={field.key}>
                        <Label className="text-xs">{field.label}</Label>
                        <div className="mt-1">
                          <StateField
                            fieldKey={field.key}
                            fieldType={field.type}
                            entity={field.entity}
                            enumValues={field.enumValues}
                            description={field.description}
                            value={getNestedValue(value, field.key)}
                            onChange={(v) => onChange(setNestedValue(value, field.key, v))}
                            catalog={catalog}
                            appointments={appointments}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
