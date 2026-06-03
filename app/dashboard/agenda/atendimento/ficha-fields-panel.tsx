"use client";

import { useEffect, useRef, useState } from "react";
import { saveFichaResponses } from "../clinical-ficha-actions";
import { FieldRender } from "../consulta/[id]/formulario-preenchimento-presencial";
import type { FormFieldDefinition } from "@/lib/form-types";
import { CheckCircle2, Loader2 } from "lucide-react";

export function FichaFieldsPanel({
  instanceId,
  templateName,
  definition,
  initialResponses,
  canEdit,
}: {
  instanceId: string;
  templateName: string;
  definition: FormFieldDefinition[];
  initialResponses: Record<string, unknown>;
  canEdit: boolean;
}) {
  const [responses, setResponses] = useState(initialResponses);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setResponses(initialResponses);
  }, [instanceId, initialResponses]);

  function scheduleSave(next: Record<string, unknown>) {
    if (!canEdit) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    timerRef.current = setTimeout(async () => {
      const res = await saveFichaResponses(instanceId, next);
      setSaveState(res.error ? "idle" : "saved");
    }, 800);
  }

  function setResponse(fieldId: string, value: unknown) {
    setResponses((prev) => {
      const next = { ...prev, [fieldId]: value };
      scheduleSave(next);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{templateName}</h2>
        {saveState === "saving" && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
          </span>
        )}
        {saveState === "saved" && (
          <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Rascunho salvo
          </span>
        )}
      </div>
      {definition.map((field) => (
        <FieldRender
          key={field.id}
          field={field}
          value={responses[field.id]}
          onChange={(v) => setResponse(field.id, v)}
          readOnly={!canEdit}
        />
      ))}
    </div>
  );
}
