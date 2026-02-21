"use client";

import React, { useEffect, useState } from "react";
import { X, User, UserPlus, Pencil, FileText, Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { formatPhoneBr, formatPhoneBrInput, parsePhoneBr } from "@/lib/format-phone";
import { createPatient, type PatientInsert } from "@/app/dashboard/pacientes/actions";
import { getPatientExams, getExamSignedUrl } from "@/app/dashboard/exames/actions";
import type { PatientExam } from "@/app/dashboard/exames/actions";
import { toast } from "@/components/ui/toast";

export type Patient = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  notes: string | null;
  custom_fields?: Record<string, unknown>;
  created_at: string;
};

export type CustomField = {
  id: string;
  field_name: string;
  field_type: "text" | "number" | "date" | "textarea" | "select";
  field_label: string;
  required: boolean;
  options: string[] | null;
  display_order: number;
};

export type AssignedSecretary = { id: string; full_name: string | null } | null;

interface WhatsAppContactSidebarProps {
  open: boolean;
  onClose: () => void;
  phoneNumber: string;
  contactName: string | null;
  patient: Patient | null;
  onPatientLinked: (patient: Patient) => void;
  onContactNameChange?: (name: string | null) => void;
  conversationId?: string | null;
  assignedSecretary?: AssignedSecretary;
  eligibleSecretaries?: Array<{ id: string; full_name: string | null }>;
  onAssignConversation?: (secretaryId: string) => Promise<void>;
  secretaries?: { id: string; full_name: string }[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  if (digits.length >= 10) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  return phone;
}

export function WhatsAppContactSidebar({
  open,
  onClose,
  phoneNumber,
  contactName,
  patient: initialPatient,
  onPatientLinked,
  conversationId,
  assignedSecretary,
  eligibleSecretaries = [],
  onAssignConversation,
  secretaries = [],
}: WhatsAppContactSidebarProps) {
  const [patient, setPatient] = useState<Patient | null>(initialPatient);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [patientExams, setPatientExams] = useState<PatientExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [form, setForm] = useState<PatientInsert & { custom_fields?: Record<string, unknown> }>({
    full_name: "",
    email: "",
    phone: "",
    birth_date: "",
    notes: "",
    custom_fields: {},
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [forwardSecretaryId, setForwardSecretaryId] = useState<string>("");
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    setPatient(initialPatient);
  }, [initialPatient]);

  // Vincular paciente à conversa ao abrir sidebar (quando paciente já existe, ex.: encontrado por telefone)
  useEffect(() => {
    if (!open || !conversationId || !initialPatient?.id) return;
    fetch("/api/whatsapp/link-patient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, patientId: initialPatient.id }),
    }).catch(() => {});
  }, [open, conversationId, initialPatient?.id]);

  useEffect(() => {
    if (!open) return;
    setLoadingPatient(false);
    if (initialPatient) {
      loadPatientExams(initialPatient.id);
    }
  }, [open, initialPatient]);

  useEffect(() => {
    if (open) {
      fetch("/api/patients/custom-fields")
        .then((r) => r.json())
        .then((data) => setCustomFields(Array.isArray(data) ? data : []))
        .catch(() => setCustomFields([]));
    }
  }, [open]);

  async function loadPatientExams(patientId: string) {
    setLoadingExams(true);
    const result = await getPatientExams(patientId);
    setPatientExams(result.data || []);
    setLoadingExams(false);
  }

  async function handleDownloadExam(exam: PatientExam) {
    const result = await getExamSignedUrl(exam.file_url);
    if (result.url) window.open(result.url, "_blank");
  }

  function openNewPatientForm() {
    const digits = phoneNumber.replace(/\D/g, "");
    const phoneForForm = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
    const initialCustomFields: Record<string, unknown> = {};
    customFields.forEach((f) => {
      initialCustomFields[f.field_name] = "";
    });
    setForm({
      full_name: contactName || "",
      email: "",
      phone: phoneForForm,
      birth_date: "",
      notes: "",
      custom_fields: initialCustomFields,
    });
    setFormError(null);
    setNewPatientOpen(true);
  }

  async function handleCreatePatient(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    const res = await createPatient({
      full_name: form.full_name,
      email: form.email || null,
      phone: parsePhoneBr(form.phone) || null,
      birth_date: form.birth_date || null,
      notes: form.notes || null,
      custom_fields: form.custom_fields || {},
    });
    setFormLoading(false);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    const newPatient: Patient = {
      id: res.patientId ?? "",
      full_name: form.full_name,
      email: form.email || null,
      phone: parsePhoneBr(form.phone) || null,
      birth_date: form.birth_date || null,
      notes: form.notes || null,
      custom_fields: form.custom_fields,
      created_at: new Date().toISOString(),
    };
    setPatient(newPatient);
    setNewPatientOpen(false);
    onPatientLinked(newPatient);
    // Vincular paciente à conversa e associar em patient_secretary se houver secretária
    if (conversationId && res.patientId) {
      try {
        await fetch("/api/whatsapp/link-patient", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, patientId: res.patientId }),
        });
      } catch {
        // Não falhar o fluxo; o vínculo pode ser feito depois
      }
    }
    toast("Paciente cadastrado com sucesso.", "success");
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
        <div
          className="relative z-10 ml-auto w-full max-w-md bg-background border-l border-border shadow-xl flex flex-col h-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Informações do contato</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {conversationId && (
              <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Atendente responsável</p>
                {assignedSecretary ? (
                  <p className="text-sm font-medium">{assignedSecretary.full_name ?? "Sem nome"}</p>
                ) : eligibleSecretaries.length > 0 ? (
                  <p className="text-sm font-medium">
                    Responsáveis: {eligibleSecretaries.map((s) => s.full_name || "Sem nome").join(", ")}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Em pool (disponível para todas)</p>
                )}
                {onAssignConversation && secretaries.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    <Select
                      value={forwardSecretaryId}
                      onChange={(e) => setForwardSecretaryId(e.target.value)}
                      className="flex-1"
                    >
                      <option value="">Selecionar secretária...</option>
                      {secretaries.map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                          disabled={assignedSecretary?.id === s.id}
                        >
                          {s.full_name}
                          {assignedSecretary?.id === s.id ? " (atual)" : ""}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!forwardSecretaryId || forwarding}
                      onClick={async () => {
                        if (!forwardSecretaryId) return;
                        setForwarding(true);
                        try {
                          await onAssignConversation(forwardSecretaryId);
                          setForwardSecretaryId("");
                          toast("Conversa encaminhada com sucesso.", "success");
                        } catch (e) {
                          toast(e instanceof Error ? e.message : "Erro ao encaminhar.", "error");
                        } finally {
                          setForwarding(false);
                        }
                      }}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Encaminhar
                    </Button>
                  </div>
                )}
              </div>
            )}
            {patient ? (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nome</p>
                    <p className="text-base font-medium">{patient.full_name}</p>
                  </div>
                  {patient.email && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">E-mail</p>
                      <p className="text-base">{patient.email}</p>
                    </div>
                  )}
                  {patient.phone && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                      <p className="text-base">{formatPhoneBr(patient.phone)}</p>
                    </div>
                  )}
                  {patient.birth_date && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data de nascimento</p>
                      <p className="text-base">{new Date(patient.birth_date).toLocaleDateString("pt-BR")}</p>
                    </div>
                  )}
                  {patient.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Observações</p>
                      <p className="text-base whitespace-pre-wrap">{patient.notes}</p>
                    </div>
                  )}
                  {customFields.length > 0 && patient.custom_fields && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Informações adicionais</p>
                      {customFields.map((field) => {
                        const value = patient.custom_fields?.[field.field_name];
                        if (!value) return null;
                        return (
                          <div key={field.id} className="mb-2">
                            <p className="text-sm font-medium text-muted-foreground">{field.field_label}</p>
                            <p className="text-base">{String(value)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t border-border">
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documentos
                  </h3>
                  {loadingExams ? (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  ) : patientExams.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum documento.</p>
                  ) : (
                    <div className="space-y-2">
                      {patientExams.map((exam) => (
                        <div
                          key={exam.id}
                          className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{exam.file_name}</p>
                            <span className="text-xs text-muted-foreground">{formatFileSize(exam.file_size)}</span>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleDownloadExam(exam)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" asChild>
                    <a href="/dashboard/pacientes">
                      <Pencil className="h-4 w-4 mr-2" />
                      Ver em Pacientes
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                </div>
                {contactName && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nome</p>
                    <p className="text-base font-medium">{contactName}</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground text-center">
                  Este número ainda não está vinculado a nenhum paciente cadastrado.
                </p>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Número</p>
                  <p className="text-base">{formatPhone(phoneNumber)}</p>
                </div>
                <Button onClick={openNewPatientForm} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar paciente
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={newPatientOpen} onOpenChange={setNewPatientOpen}>
        <DialogContent title="Novo paciente" onClose={() => setNewPatientOpen(false)}>
          <form onSubmit={handleCreatePatient} className="space-y-4">
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{formError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="wa_full_name">Nome completo *</Label>
              <Input
                id="wa_full_name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                required
                placeholder="Ex.: Maria Silva"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wa_birth_date">Data de nascimento</Label>
                <Input
                  id="wa_birth_date"
                  type="date"
                  value={form.birth_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa_email">E-mail</Label>
                <Input
                  id="wa_email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa_phone">Telefone</Label>
              <Input
                id="wa_phone"
                type="tel"
                inputMode="numeric"
                value={formatPhoneBrInput(form.phone ?? "")}
                onChange={(e) => setForm((f) => ({ ...f, phone: parsePhoneBr(e.target.value) }))}
                placeholder="(62) 99691-5034"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa_notes">Observações</Label>
              <Textarea
                id="wa_notes"
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Anotações sobre o paciente"
                rows={2}
              />
            </div>
            {customFields.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="font-medium text-sm">Informações adicionais</h3>
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={`wa_custom_${field.field_name}`}>
                      {field.field_label}
                      {field.required && " *"}
                    </Label>
                    {field.field_type === "textarea" ? (
                      <Textarea
                        id={`wa_custom_${field.field_name}`}
                        value={String(form.custom_fields?.[field.field_name] ?? "")}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            custom_fields: { ...f.custom_fields, [field.field_name]: e.target.value },
                          }))
                        }
                        required={field.required}
                        rows={3}
                      />
                    ) : field.field_type === "select" ? (
                      <select
                        id={`wa_custom_${field.field_name}`}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        value={String(form.custom_fields?.[field.field_name] ?? "")}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            custom_fields: { ...f.custom_fields, [field.field_name]: e.target.value },
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
                        id={`wa_custom_${field.field_name}`}
                        type="date"
                        value={String(form.custom_fields?.[field.field_name] ?? "")}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            custom_fields: { ...f.custom_fields, [field.field_name]: e.target.value },
                          }))
                        }
                        required={field.required}
                      />
                    ) : field.field_type === "number" ? (
                      <Input
                        id={`wa_custom_${field.field_name}`}
                        type="number"
                        value={String(form.custom_fields?.[field.field_name] ?? "")}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            custom_fields: {
                              ...f.custom_fields,
                              [field.field_name]: e.target.value === "" ? "" : Number(e.target.value),
                            },
                          }))
                        }
                        required={field.required}
                      />
                    ) : (
                      <Input
                        id={`wa_custom_${field.field_name}`}
                        type="text"
                        value={String(form.custom_fields?.[field.field_name] ?? "")}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            custom_fields: { ...f.custom_fields, [field.field_name]: e.target.value },
                          }))
                        }
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Cadastrando…" : "Cadastrar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setNewPatientOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
