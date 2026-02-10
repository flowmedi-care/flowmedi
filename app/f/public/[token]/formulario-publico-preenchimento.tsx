"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { FormFieldDefinition } from "@/lib/form-types";
import { Check } from "lucide-react";
import { LogoImage } from "@/components/logo-image";

type FieldDef = FormFieldDefinition & { id: string };

type BasicData = {
  name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  age: number | null;
};

type CustomField = {
  id: string;
  field_name: string;
  field_type: "text" | "number" | "date" | "textarea" | "select";
  field_label: string;
  required: boolean;
  options: string[] | null;
  display_order: number;
};

export function FormularioPublicoPreenchimento({
  templateName,
  definition,
  initialResponses,
  templateId,
  basicData,
  customFields = [],
  doctorLogoUrl,
  doctorLogoScale,
  doctorName,
}: {
  templateName: string;
  definition: FieldDef[];
  initialResponses: Record<string, unknown>;
  templateId: string;
  basicData: BasicData;
  customFields?: CustomField[];
  doctorLogoUrl?: string | null;
  doctorLogoScale?: number;
  doctorName?: string | null;
}) {
  const [step, setStep] = useState<"basic" | "form">(
    basicData.name && basicData.email ? "form" : "basic"
  );
  const [basicForm, setBasicForm] = useState({
    name: basicData.name || "",
    email: basicData.email || "",
    phone: basicData.phone || "",
    birth_date: basicData.birth_date || "",
  });
  const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, unknown>>({});
  const [responses, setResponses] = useState<Record<string, unknown>>(initialResponses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function setResponse(fieldId: string, value: unknown) {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  }

  function handleBasicSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!basicForm.name.trim() || !basicForm.email.trim()) {
      setError("Nome e email são obrigatórios.");
      return;
    }
    setError(null);
    setStep("form");
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    
    // Separar campos customizados das respostas do formulário
    const formResponses: Record<string, unknown> = {};
    const customFieldsData: Record<string, unknown> = {};
    
    // Campos customizados têm prefixo baseado no field_name
    customFields.forEach((field) => {
      if (customFieldsValues[field.field_name] !== undefined) {
        customFieldsData[field.field_name] = customFieldsValues[field.field_name];
      }
    });
    
    // Respostas do formulário são todas as outras (não customizadas)
    Object.keys(responses).forEach((key) => {
      if (!customFieldsData.hasOwnProperty(key)) {
        formResponses[key] = responses[key];
      }
    });
    
    // Criar nova instância pública para esta resposta
    const { data, error: rpcError } = await supabase.rpc("create_public_form_instance", {
      p_template_id: templateId,
      p_submitter_name: basicForm.name.trim(),
      p_submitter_email: basicForm.email.trim(),
      p_submitter_phone: basicForm.phone.trim() || null,
      p_submitter_birth_date: basicForm.birth_date || null,
      p_responses: formResponses,
      p_custom_fields: Object.keys(customFieldsData).length > 0 ? customFieldsData : null,
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
          <p className="text-center text-sm text-muted-foreground mt-2">
            Entraremos em contato em breve.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step === "basic") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{templateName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Por favor, preencha seus dados básicos para continuar.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBasicSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">
                Nome completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={basicForm.name}
                onChange={(e) => setBasicForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Seu nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={basicForm.email}
                onChange={(e) => setBasicForm((f) => ({ ...f, email: e.target.value }))}
                required
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                value={basicForm.phone}
                onChange={(e) => setBasicForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth_date">Data de nascimento</Label>
              <Input
                id="birth_date"
                type="date"
                value={basicForm.birth_date}
                onChange={(e) => setBasicForm((f) => ({ ...f, birth_date: e.target.value }))}
              />
            </div>
            
            {customFields.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="font-medium text-sm">Informações Adicionais</h3>
                {customFields.map((field) => {
                  const fieldValue = customFieldsValues[field.field_name] ?? "";
                  return (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={`custom_${field.field_name}`}>
                        {field.field_label}
                        {field.required && <span className="text-destructive"> *</span>}
                      </Label>
                      {field.field_type === "textarea" ? (
                        <textarea
                          id={`custom_${field.field_name}`}
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={String(fieldValue)}
                          onChange={(e) =>
                            setCustomFieldsValues((f) => ({
                              ...f,
                              [field.field_name]: e.target.value,
                            }))
                          }
                          required={field.required}
                          rows={3}
                        />
                      ) : field.field_type === "select" ? (
                        <select
                          id={`custom_${field.field_name}`}
                          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                          value={String(fieldValue)}
                          onChange={(e) =>
                            setCustomFieldsValues((f) => ({
                              ...f,
                              [field.field_name]: e.target.value,
                            }))
                          }
                          required={field.required}
                        >
                          <option value="">Selecione</option>
                          {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.field_type === "date" ? (
                        <Input
                          id={`custom_${field.field_name}`}
                          type="date"
                          value={String(fieldValue)}
                          onChange={(e) =>
                            setCustomFieldsValues((f) => ({
                              ...f,
                              [field.field_name]: e.target.value,
                            }))
                          }
                          required={field.required}
                        />
                      ) : field.field_type === "number" ? (
                        <Input
                          id={`custom_${field.field_name}`}
                          type="number"
                          value={String(fieldValue)}
                          onChange={(e) =>
                            setCustomFieldsValues((f) => ({
                              ...f,
                              [field.field_name]: e.target.value === "" ? "" : Number(e.target.value),
                            }))
                          }
                          required={field.required}
                        />
                      ) : (
                        <Input
                          id={`custom_${field.field_name}`}
                          type="text"
                          value={String(fieldValue)}
                          onChange={(e) =>
                            setCustomFieldsValues((f) => ({
                              ...f,
                              [field.field_name]: e.target.value,
                            }))
                          }
                          required={field.required}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            <Button type="submit" className="w-full">
              Continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{templateName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
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
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Enviando…" : "Enviar formulário"}
          </Button>
        </form>
        {doctorLogoUrl && (
          <div className="flex flex-col items-center mt-12 pt-8 pb-4 border-t border-border">
            {doctorName && (
              <p className="text-sm text-muted-foreground mb-4">{doctorName}</p>
            )}
            <LogoImage
              src={doctorLogoUrl}
              alt="Assinatura do médico"
              className="max-h-20 max-w-full object-contain"
              scale={doctorLogoScale ?? 100}
            />
          </div>
        )}
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
  field: FieldDef;
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
