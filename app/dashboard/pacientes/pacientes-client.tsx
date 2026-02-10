"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createPatient, updatePatient, deletePatient, registerPatientFromPublicForm, type PatientInsert, type PatientUpdate } from "./actions";
import { Search, UserPlus, Pencil, Trash2, X, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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

export type NonRegisteredSubmitter = {
  email: string;
  name: string | null;
  phone: string | null;
  birth_date: string | null;
  custom_fields?: Record<string, unknown>;
  forms: Array<{
    id: string;
    template_name: string;
    status: string;
    created_at: string;
  }>;
  latest_form_date: string;
};

export function PacientesClient({
  initialPatients,
  customFields,
  nonRegistered = [],
}: {
  initialPatients: Patient[];
  customFields: CustomField[];
  nonRegistered?: NonRegisteredSubmitter[];
}) {
  const [activeTab, setActiveTab] = useState<"registered" | "nonRegistered">("registered");
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [nonRegisteredList, setNonRegisteredList] = useState<NonRegisteredSubmitter[]>(nonRegistered);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [patientToExcluir, setPatientToExcluir] = useState<Patient | null>(null);
  const [registeringEmail, setRegisteringEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PatientInsert & { id?: string; custom_fields?: Record<string, unknown> }>({
    full_name: "",
    email: "",
    phone: "",
    birth_date: "",
    notes: "",
    custom_fields: {},
  });

  const filtered = patients.filter(
    (p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(search.toLowerCase())) ||
      (p.phone && p.phone.replace(/\D/g, "").includes(search.replace(/\D/g, "")))
  );

  const filteredNonRegistered = nonRegisteredList.filter(
    (nr) =>
      (nr.name && nr.name.toLowerCase().includes(search.toLowerCase())) ||
      nr.email.toLowerCase().includes(search.toLowerCase()) ||
      (nr.phone && nr.phone.replace(/\D/g, "").includes(search.replace(/\D/g, "")))
  );

  async function handleRegisterPatient(nr: NonRegisteredSubmitter) {
    if (!nr.email) {
      setError("Email não encontrado.");
      return;
    }
    setRegisteringEmail(nr.email);
    setError(null);
    const res = await registerPatientFromPublicForm(nr.email, {
      full_name: nr.name || "Sem nome",
      phone: nr.phone,
      birth_date: nr.birth_date,
      custom_fields: nr.custom_fields,
    });
    setRegisteringEmail(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    // Remover da lista de não-cadastrados
    setNonRegisteredList((prev) => prev.filter((n) => n.email !== nr.email));
    // Atualizar página para mostrar paciente cadastrado
    router.refresh();
  }

  function openNew() {
    setEditingId(null);
    setIsNew(true);
    const initialCustomFields: Record<string, unknown> = {};
    customFields.forEach((field) => {
      if (field.field_type === "select") {
        initialCustomFields[field.field_name] = "";
      } else if (field.field_type === "number") {
        initialCustomFields[field.field_name] = "";
      } else {
        initialCustomFields[field.field_name] = "";
      }
    });
    setForm({
      full_name: "",
      email: "",
      phone: "",
      birth_date: "",
      notes: "",
      custom_fields: initialCustomFields,
    });
    setError(null);
  }

  function openEdit(p: Patient) {
    setIsNew(false);
    setEditingId(p.id);
    const initialCustomFields: Record<string, unknown> = {};
    customFields.forEach((field) => {
      initialCustomFields[field.field_name] = p.custom_fields?.[field.field_name] ?? "";
    });
    setForm({
      id: p.id,
      full_name: p.full_name,
      email: p.email ?? "",
      phone: p.phone ?? "",
      birth_date: p.birth_date ?? "",
      notes: p.notes ?? "",
      custom_fields: initialCustomFields,
    });
    setError(null);
  }

  function cancelForm() {
    setEditingId(null);
    setIsNew(false);
    setError(null);
  }

  function openExcluirConfirm(p: Patient) {
    setPatientToExcluir(p);
  }

  async function handleConfirmExcluirPatient() {
    if (!patientToExcluir) return;
    setDeletingId(patientToExcluir.id);
    const res = await deletePatient(patientToExcluir.id);
    setDeletingId(null);
    if (!res.error) {
      setPatientToExcluir(null);
      router.refresh();
    } else {
      setError(res.error);
      setPatientToExcluir(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (isNew) {
      const res = await createPatient({
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        birth_date: form.birth_date || null,
        notes: form.notes || null,
        custom_fields: form.custom_fields || {},
      });
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setPatients((prev) => [
        ...prev,
        {
          id: "",
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone || null,
          birth_date: form.birth_date || null,
          notes: form.notes || null,
          created_at: new Date().toISOString(),
        },
      ]);
      cancelForm();
      window.location.reload();
      return;
    }
    if (editingId) {
      const update: PatientUpdate = {
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        birth_date: form.birth_date || null,
        notes: form.notes || null,
        custom_fields: form.custom_fields || {},
      };
      const res = await updatePatient(editingId, update);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setPatients((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? {
                ...p,
                full_name: form.full_name,
                email: form.email || null,
                phone: form.phone || null,
                birth_date: form.birth_date || null,
                notes: form.notes || null,
              }
            : p
        )
      );
      cancelForm();
    }
    setLoading(false);
  }

  const showForm = isNew || editingId !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {activeTab === "registered" && (
          <Button onClick={openNew}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo paciente
          </Button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("registered")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "registered"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Cadastrados ({patients.length})
        </button>
        <button
          onClick={() => setActiveTab("nonRegistered")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "nonRegistered"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Não Cadastrados ({nonRegisteredList.length})
        </button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">
                {isNew ? "Cadastrar paciente" : "Editar paciente"}
              </h2>
              <Button variant="ghost" size="sm" onClick={cancelForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                  {error}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome completo *</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, full_name: e.target.value }))
                    }
                    required
                    placeholder="Ex.: Maria Silva"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birth_date">Data de nascimento</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={form.birth_date ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, birth_date: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={form.notes ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Anotações sobre o paciente"
                  rows={2}
                />
              </div>
              
              {customFields.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="font-medium text-sm">Informações Adicionais</h3>
                  {customFields.map((field) => {
                    const fieldValue = form.custom_fields?.[field.field_name] ?? "";
                    return (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={`custom_${field.field_name}`}>
                          {field.field_label}
                          {field.required && " *"}
                        </Label>
                        {field.field_type === "textarea" ? (
                          <Textarea
                            id={`custom_${field.field_name}`}
                            value={String(fieldValue)}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                custom_fields: {
                                  ...f.custom_fields,
                                  [field.field_name]: e.target.value,
                                },
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
                              setForm((f) => ({
                                ...f,
                                custom_fields: {
                                  ...f.custom_fields,
                                  [field.field_name]: e.target.value,
                                },
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
                              setForm((f) => ({
                                ...f,
                                custom_fields: {
                                  ...f.custom_fields,
                                  [field.field_name]: e.target.value,
                                },
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
                            id={`custom_${field.field_name}`}
                            type="text"
                            value={String(fieldValue)}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                custom_fields: {
                                  ...f.custom_fields,
                                  [field.field_name]: e.target.value,
                                },
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
              
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando…" : isNew ? "Cadastrar" : "Salvar"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "registered" ? (
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">
              {filtered.length} paciente(s) encontrado(s)
            </p>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Nenhum paciente cadastrado ou nenhum resultado para a busca.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0",
                      editingId === p.id && "bg-muted/50 -mx-2 px-2 rounded"
                    )}
                  >
                    <div>
                      <p className="font-medium">{p.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[p.email, p.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openExcluirConfirm(p)}
                        disabled={deletingId === p.id}
                        title="Excluir cadastro"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">
              {filteredNonRegistered.length} pessoa(s) encontrada(s) que preencheram formulários públicos
            </p>
          </CardHeader>
          <CardContent>
            {filteredNonRegistered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Nenhuma pessoa não cadastrada encontrada.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filteredNonRegistered.map((nr) => (
                  <li
                    key={nr.email}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{nr.name || "Sem nome"}</p>
                      <p className="text-sm text-muted-foreground">
                        {[nr.email, nr.phone].filter(Boolean).join(" · ") || nr.email}
                      </p>
                      {nr.birth_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Nascimento: {new Date(nr.birth_date).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {nr.forms.length} formulário(s) respondido(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleRegisterPatient(nr)}
                        disabled={registeringEmail === nr.email}
                        title="Cadastrar paciente"
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        {registeringEmail === nr.email ? "Cadastrando..." : "Cadastrar"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!patientToExcluir}
        title="Excluir cadastro"
        message="Tem certeza que deseja excluir o cadastro deste paciente?"
        confirmLabel="Excluir"
        variant="destructive"
        loading={deletingId !== null}
        onConfirm={handleConfirmExcluirPatient}
        onCancel={() => setPatientToExcluir(null)}
      />
    </div>
  );
}
