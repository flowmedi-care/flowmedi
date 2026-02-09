"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createPatient, updatePatient, deletePatient, type PatientInsert, type PatientUpdate } from "./actions";
import { Search, UserPlus, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Patient = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  notes: string | null;
  created_at: string;
};

export function PacientesClient({
  initialPatients,
}: {
  initialPatients: Patient[];
}) {
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [patientToExcluir, setPatientToExcluir] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PatientInsert & { id?: string }>({
    full_name: "",
    email: "",
    phone: "",
    birth_date: "",
    notes: "",
  });

  const filtered = patients.filter(
    (p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(search.toLowerCase())) ||
      (p.phone && p.phone.replace(/\D/g, "").includes(search.replace(/\D/g, "")))
  );

  function openNew() {
    setEditingId(null);
    setIsNew(true);
    setForm({
      full_name: "",
      email: "",
      phone: "",
      birth_date: "",
      notes: "",
    });
    setError(null);
  }

  function openEdit(p: Patient) {
    setIsNew(false);
    setEditingId(p.id);
    setForm({
      id: p.id,
      full_name: p.full_name,
      email: p.email ?? "",
      phone: p.phone ?? "",
      birth_date: p.birth_date ?? "",
      notes: p.notes ?? "",
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
        <Button onClick={openNew}>
          <UserPlus className="h-4 w-4 mr-2" />
          Novo paciente
        </Button>
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
