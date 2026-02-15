"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createPatient, updatePatient, deletePatient, registerPatientFromPublicForm, type PatientInsert, type PatientUpdate } from "./actions";
import { Search, UserPlus, Pencil, Trash2, X, UserCheck, User, Download, FileText, Grid3x3, List, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import Link from "next/link";
import { ExamesClient } from "../exames/exames-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getPatientExams, getExamSignedUrl, type PatientExam } from "../exames/actions";

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
  userRole,
}: {
  initialPatients: Patient[];
  customFields: CustomField[];
  nonRegistered?: NonRegisteredSubmitter[];
  userRole: string;
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
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientExams, setPatientExams] = useState<PatientExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [viewMode, setViewMode] = useState<"contacts" | "list">("contacts");
  const [justRegisteredPatientId, setJustRegisteredPatientId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [form, setForm] = useState<PatientInsert & { id?: string; custom_fields?: Record<string, unknown> }>({
    full_name: "",
    email: "",
    phone: "",
    birth_date: "",
    notes: "",
    custom_fields: {},
  });

  // Abrir formulário se vier ?new=true na URL
  useEffect(() => {
    const shouldOpenForm = searchParams.get("new") === "true";
    if (shouldOpenForm && !isNew && !editingId) {
      openNew();
      // Limpar query params
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("new");
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, isNew, editingId, router]);

  // Carregar exames quando um paciente for selecionado (para todos os usuários)
  useEffect(() => {
    if (selectedPatient) {
      loadPatientExams(selectedPatient.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient]);


  async function loadPatientExams(patientId: string) {
    setLoadingExams(true);
    const result = await getPatientExams(patientId);
    if (result.error) {
      setError(result.error);
    } else {
      setPatientExams(result.data || []);
    }
    setLoadingExams(false);
  }

  async function handleDownloadExam(exam: PatientExam) {
    const result = await getExamSignedUrl(exam.file_url);
    if (result.error) {
      setError(result.error);
    } else if (result.url) {
      window.open(result.url, "_blank");
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // Filtrar pacientes em tempo real conforme digita
  const filtered = useMemo(() => {
    const searchValue = search.trim();
    
    if (!searchValue) {
      return patients;
    }
    
    const searchLower = searchValue.toLowerCase();
    const searchNumbers = searchValue.replace(/\D/g, "");
    
    return patients.filter((p) => {
      // Buscar no nome
      if (p.full_name.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Buscar no email (se existir)
      if (p.email && p.email.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Buscar no telefone (se existir e a busca tiver números)
      if (searchNumbers.length > 0 && p.phone) {
        const phoneNumbers = p.phone.replace(/\D/g, "");
        if (phoneNumbers.includes(searchNumbers)) {
          return true;
        }
      }
      
      return false;
    });
  }, [patients, search]);

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
    // Remover da lista de não-cadastrados localmente
    setNonRegisteredList((prev) => prev.filter((n) => n.email !== nr.email));
    // Recarregar dados do servidor para atualizar ambas as listas
    router.refresh();
  }

  const openNew = () => {
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
  };

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
      const newId = res.patientId ?? "";
      setPatients((prev) => [
        ...prev,
        {
          id: newId,
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone || null,
          birth_date: form.birth_date || null,
          notes: form.notes || null,
          created_at: new Date().toISOString(),
        },
      ]);
      cancelForm();
      setJustRegisteredPatientId(newId);
      toast(
        "Paciente cadastrado. Evento criado na Central de Eventos. Sugestão: agendar uma consulta.",
        "success"
      );
      router.refresh();
      setLoading(false);
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
      {justRegisteredPatientId && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <span className="text-sm text-green-800 dark:text-green-200">
            Evento criado. Sugestão: agendar uma consulta para este paciente.
          </span>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="bg-green-700 hover:bg-green-800 text-white">
              <Link href={`/dashboard/consulta?patientId=${justRegisteredPatientId}`}>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Agendar consulta
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setJustRegisteredPatientId(null)}
              className="text-green-800 dark:text-green-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={(e) => {
              const newValue = e.target.value;
              setSearch(newValue);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "registered" && (
            <>
              <Button
                variant={viewMode === "contacts" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("contacts")}
                title="Visualização de contatos"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                title="Visualização em lista"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button onClick={openNew}>
                <UserPlus className="h-4 w-4 mr-2" />
                Novo paciente
              </Button>
            </>
          )}
        </div>
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

      {/* Seção de Exames - Mostrar quando editando um paciente existente */}
      {editingId && !isNew && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Exames do Paciente</h2>
          </CardHeader>
          <CardContent>
            <ExamesClient patientId={editingId} canEdit={true} />
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
            ) : viewMode === "contacts" ? (
              // Visualização de contatos (padrão para todos)
              <div className="h-[600px] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filtered.map((p) => (
                    <Card
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedPatient(p)}
                    >
                      <CardContent className="pt-6 pb-4 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                          <User className="h-8 w-8 text-primary" />
                        </div>
                        <p className="font-medium text-sm truncate w-full">{p.full_name}</p>
                        {p.phone && (
                          <p className="text-xs text-muted-foreground mt-1 truncate w-full">
                            {p.phone}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
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

      {/* Modal de detalhes do paciente (para todos os usuários) */}
      {selectedPatient && (
        <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
          <DialogContent 
            title={selectedPatient?.full_name || "Detalhes do Paciente"}
            onClose={() => setSelectedPatient(null)}
          >
            {selectedPatient && (
              <div className="space-y-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-10 w-10 text-primary" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nome completo</p>
                    <p className="text-base">{selectedPatient.full_name}</p>
                  </div>
                  
                  {selectedPatient.email && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">E-mail</p>
                      <p className="text-base">{selectedPatient.email}</p>
                    </div>
                  )}
                  
                  {selectedPatient.phone && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                      <p className="text-base">{selectedPatient.phone}</p>
                    </div>
                  )}
                  
                  {selectedPatient.birth_date && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Data de nascimento</p>
                      <p className="text-base">
                        {new Date(selectedPatient.birth_date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}
                  
                  {selectedPatient.notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Observações</p>
                      <p className="text-base whitespace-pre-wrap">{selectedPatient.notes}</p>
                    </div>
                  )}
                  
                  {customFields.length > 0 && selectedPatient.custom_fields && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Informações Adicionais</p>
                      {customFields.map((field) => {
                        const value = selectedPatient.custom_fields?.[field.field_name];
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

                {/* Seção de Documentos/Exames */}
                <div className="pt-4 border-t border-border">
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documentos
                  </h3>
                  {loadingExams ? (
                    <p className="text-sm text-muted-foreground py-4">Carregando documentos...</p>
                  ) : patientExams.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Nenhum documento encontrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {patientExams.map((exam) => (
                        <div
                          key={exam.id}
                          className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{exam.file_name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {exam.exam_type && (
                                <span className="text-xs text-muted-foreground">{exam.exam_type}</span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(exam.file_size)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(exam.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            {exam.description && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {exam.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadExam(exam)}
                            className="ml-3 shrink-0"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Baixar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedPatient(null);
                      openEdit(selectedPatient);
                    }}
                    className="flex-1"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  {(userRole === "admin" || userRole === "secretaria") && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setSelectedPatient(null);
                        openExcluirConfirm(selectedPatient);
                      }}
                      className="flex-1"
                      disabled={deletingId === selectedPatient.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
