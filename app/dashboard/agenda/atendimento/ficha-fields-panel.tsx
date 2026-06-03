"use client";

import { useEffect, useRef, useState } from "react";
import { saveFichaResponses } from "../clinical-ficha-actions";
import { FieldRender } from "../consulta/[id]/formulario-preenchimento-presencial";
import type { FormFieldDefinition } from "@/lib/form-types";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";

function normalizeDefinition(definition: FormFieldDefinition[]): FormFieldDefinition[] {
  return definition.map((field, index) => ({
    ...field,
    id: field.id?.trim() ? field.id : `field-${index}`,
  }));
}

export function FichaFieldsPanel({
  instanceId,
  templateName,
  definition,
  initialResponses,
  /** Quando false, campos ficam somente leitura. Default: editável. */
  interactive = true,
}: {
  instanceId: string;
  templateName: string;
  definition: FormFieldDefinition[];
  initialResponses: Record<string, unknown>;
  interactive?: boolean;
}) {
  const fields = normalizeDefinition(definition);
  const [responses, setResponses] = useState<Record<string, unknown>>(() => ({
    ...initialResponses,
  }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responsesRef = useRef(responses);
  responsesRef.current = responses;

  useEffect(() => {
    setResponses({ ...initialResponses });
    setSaveState("idle");
  }, [instanceId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function scheduleSave(next: Record<string, unknown>) {
    if (!interactive) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    timerRef.current = setTimeout(async () => {
      const res = await saveFichaResponses(instanceId, next);
      if (res.error) {
        setSaveState("idle");
        toast(res.error, "error");
      } else {
        setSaveState("saved");
      }
    }, 800);
  }

  function setResponse(fieldId: string, value: unknown) {
    if (!interactive) return;
    const next = { ...responsesRef.current, [fieldId]: value };
    responsesRef.current = next;
    setResponses(next);
    scheduleSave(next);
  }

  return (
    <div className="relative z-10 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{templateName}</h2>
        {interactive && saveState === "saving" && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
          </span>
        )}
        {interactive && saveState === "saved" && (
          <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Rascunho salvo
          </span>
        )}
      </div>
      {!interactive && (
        <p className="text-sm text-muted-foreground rounded-md border bg-muted/30 px-3 py-2">
          Ficha concluída — somente leitura.
        </p>
      )}
      {fields.map((field) => (
        <FieldRender
          key={field.id}
          field={field}
          value={responses[field.id]}
          onChange={(v) => setResponse(field.id, v)}
          {...(interactive ? {} : { readOnly: true })}
        />
      ))}
    </div>
  );
}
