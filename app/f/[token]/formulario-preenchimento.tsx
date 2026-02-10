"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { FormFieldDefinition, FormFieldType } from "@/lib/form-types";
import { Check } from "lucide-react";

type FieldDef = FormFieldDefinition & { id: string };

function FieldRender({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}) {
  const id = field.id;
  const required = field.required ?? false;

  if (readOnly) {
    const display =
      field.type === "multiple_choice" && Array.isArray(value)
        ? value.join(", ")
        : value != null && value !== ""
          ? String(value)
          : "—";
    return (
      <div className="space-y-1">
        <Label className="text-muted-foreground font-normal">{field.label}</Label>
        <p className="text-sm">{display}</p>
      </div>
    );
  }

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
          <Textarea
            id={id}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={required}
            rows={4}
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
          />
        </div>
      );
  }
}

type PatientData = {
  name: string | null;
  email: string | null;
  phone: string | null;
  age: number | null;
};

export function FormularioPreenchimento({
  templateName,
  definition,
  initialResponses,
  token,
  readOnly,
  doctorLogoUrl,
  patientData,
}: {
  templateName: string;
  definition: FieldDef[];
  initialResponses: Record<string, unknown>;
  instanceId: string;
  token: string;
  readOnly?: boolean;
  doctorLogoUrl?: string | null;
  patientData?: PatientData;
}) {
  const [responses, setResponses] = useState<Record<string, unknown>>(initialResponses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function setResponse(fieldId: string, value: unknown) {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("submit_form_by_token", {
      p_token: token,
      p_responses: responses,
    });
    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }
    if (data?.success) {
      setSuccess(true);
    } else {
      setError((data as { error?: string })?.error ?? "Erro ao enviar.");
    }
    setLoading(false);
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-foreground font-medium">
            Formulário enviado com sucesso. Obrigado!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Extrair primeiro nome do paciente para mensagem personalizada
  const patientFirstName = patientData?.name 
    ? patientData.name.split(' ')[0] 
    : null;

  return (
    <Card>
      <CardHeader>
        <h1 className="text-xl font-semibold">{templateName}</h1>
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Você já respondeu este formulário."
            : patientFirstName
              ? `Olá ${patientFirstName}, preencha as informações abaixo.`
              : "Preencha os campos abaixo."}
        </p>
      </CardHeader>
      <CardContent>
        {/* Informações básicas do paciente (somente leitura) */}
        {patientData && (patientData.name || patientData.email || patientData.phone || patientData.age !== null) && (
          <div className="mb-6 pb-6 border-b border-border">
            <h2 className="text-sm font-medium text-foreground mb-4">Informações do Paciente</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {patientData.name && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Nome completo</Label>
                  <p className="text-sm font-medium">{patientData.name}</p>
                </div>
              )}
              {patientData.age !== null && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Idade</Label>
                  <p className="text-sm font-medium">{patientData.age} anos</p>
                </div>
              )}
              {patientData.email && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">E-mail</Label>
                  <p className="text-sm font-medium">{patientData.email}</p>
                </div>
              )}
              {patientData.phone && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <p className="text-sm font-medium">{patientData.phone}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
              {error}
            </p>
          )}
          {definition.map((field) => (
            <FieldRender
              key={field.id}
              field={field}
              value={responses[field.id]}
              onChange={(v) => setResponse(field.id, v)}
              readOnly={readOnly}
            />
          ))}
          {!readOnly && definition.length > 0 && (
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Enviando…" : "Enviar formulário"}
            </Button>
          )}
        </form>
        {doctorLogoUrl && (
          <div className="flex justify-center mt-6 pt-6 border-t border-border">
            <img
              src={doctorLogoUrl}
              alt="Logo do médico"
              className="max-h-20 max-w-full object-contain"
              onError={(e) => {
                // Esconde a imagem se não carregar
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
