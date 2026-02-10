"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitFormPresentially } from "./formularios-consulta-actions";
import { X, Check } from "lucide-react";
import type { FormFieldDefinition } from "@/lib/form-types";

export function FormularioPreenchimentoPresencial({
  formInstanceId,
  templateName,
  definition,
  initialResponses,
  onCancel,
  onSuccess,
}: {
  formInstanceId: string;
  templateName: string;
  definition: (FormFieldDefinition & { id: string })[];
  initialResponses: Record<string, unknown>;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [responses, setResponses] = useState<Record<string, unknown>>(initialResponses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setResponse(fieldId: string, value: unknown) {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await submitFormPresentially(formInstanceId, responses);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onSuccess();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h3 className="font-semibold">{templateName}</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          {definition.map((field) => (
            <FieldRender
              key={field.id}
              field={field}
              value={responses[field.id]}
              onChange={(v) => setResponse(field.id, v)}
              readOnly={false}
            />
          ))}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar respostas"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FieldRender({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: FormFieldDefinition & { id: string };
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}) {
  const id = `field_${field.id}`;
  const required = field.required ?? false;

  switch (field.type) {
    case "short_text":
      return (
        <div className="space-y-2">
          <Label htmlFor={id}>
            {field.label}
            {required && " *"}
          </Label>
          <Input
            id={id}
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={required}
            readOnly={readOnly}
          />
        </div>
      );
    case "long_text":
      return (
        <div className="space-y-2">
          <Label htmlFor={id}>
            {field.label}
            {required && " *"}
          </Label>
          <textarea
            id={id}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={required}
            readOnly={readOnly}
            rows={4}
          />
        </div>
      );
    case "date":
      return (
        <div className="space-y-2">
          <Label htmlFor={id}>
            {field.label}
            {required && " *"}
          </Label>
          <Input
            id={id}
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            readOnly={readOnly}
          />
        </div>
      );
    case "number":
      return (
        <div className="space-y-2">
          <Label htmlFor={id}>
            {field.label}
            {required && " *"}
          </Label>
          <Input
            id={id}
            type="number"
            min={field.min}
            max={field.max}
            value={(value as number | string) ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? "" : Number(v));
            }}
            placeholder={field.placeholder}
            required={required}
            readOnly={readOnly}
          />
        </div>
      );
    case "yes_no":
      return (
        <div className="space-y-2">
          <Label>
            {field.label}
            {required && " *"}
          </Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={id}
                value="yes"
                checked={(value as string) === "yes"}
                onChange={() => onChange("yes")}
                required={required}
                disabled={readOnly}
              />
              Sim
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={id}
                value="no"
                checked={(value as string) === "no"}
                onChange={() => onChange("no")}
                disabled={readOnly}
              />
              Não
            </label>
          </div>
        </div>
      );
    case "single_choice":
      return (
        <div className="space-y-2">
          <Label>
            {field.label}
            {required && " *"}
          </Label>
          <div className="space-y-2" role="radiogroup" aria-label={field.label}>
            {(field.options ?? []).map((opt) => {
              const isSelected = (value as string) === opt;
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 rounded border border-input px-3 py-2 cursor-pointer hover:bg-muted/50 has-[:focus]:ring-2 has-[:focus]:ring-ring"
                >
                  <input
                    type="radio"
                    name={id}
                    value={opt}
                    checked={isSelected}
                    onChange={() => onChange(opt)}
                    required={required}
                    disabled={readOnly}
                    className="sr-only"
                  />
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary"
                    aria-hidden
                  >
                    {isSelected ? (
                      <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      );
    case "multiple_choice":
      const arr = (Array.isArray(value) ? value : []) as string[];
      return (
        <div className="space-y-2">
          <Label>
            {field.label}
            {required && " *"}
          </Label>
          <div className="space-y-2" role="group" aria-label={field.label}>
            {(field.options ?? []).map((opt) => {
              const isChecked = arr.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 rounded border border-input px-3 py-2 cursor-pointer hover:bg-muted/50 has-[:focus]:ring-2 has-[:focus]:ring-ring"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange([...arr, opt]);
                      } else {
                        onChange(arr.filter((x) => x !== opt));
                      }
                    }}
                    disabled={readOnly}
                    className="sr-only"
                  />
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-primary"
                    aria-hidden
                  >
                    {isChecked ? (
                      <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      );
    default:
      return (
        <div className="space-y-2">
          <Label htmlFor={id}>{field.label}</Label>
          <Input
            id={id}
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readOnly}
          />
        </div>
      );
  }
}
