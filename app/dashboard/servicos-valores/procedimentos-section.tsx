"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createProcedure,
  updateProcedure,
  deleteProcedure,
  syncDoctorProcedures,
  syncProcedureProducts,
  getProcedureProducts,
  type ProcedureRow,
  type ProcedureProductRow,
} from "@/app/dashboard/campos-pacientes/actions";
import type { ClinicalFichaTemplateRow } from "@/app/dashboard/campos-pacientes/clinical-fichas-actions";
import {
  getProcedureClinicalFichaIds,
  syncProcedureClinicalFichas,
} from "@/app/dashboard/campos-pacientes/clinical-fichas-actions";
import { Plus, Pencil, Check, UserCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { recurrenceBillingModeLabel } from "@/lib/recurrence-billing";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type DoctorOption = { id: string; full_name: string };

export function ProcedimentosSection({
  initialProcedures,
  doctors,
  doctorIdsByProcedureId,
  services,
  products,
  fichaTemplates,
  onMutate,
}: {
  initialProcedures: ProcedureRow[];
  doctors: DoctorOption[];
  doctorIdsByProcedureId: Record<string, string[]>;
  services: {
    id: string;
    nome: string;
    recurrence_billing_mode: "per_session" | "treatment_plan" | null;
  }[];
  products: { id: string; name: string; unit: string }[];
  fichaTemplates: ClinicalFichaTemplateRow[];
  onMutate: () => void;
}) {
  const [procedures, setProcedures] = useState<ProcedureRow[]>(initialProcedures);
  useEffect(() => {
    setProcedures(initialProcedures);
  }, [initialProcedures]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [defaultServiceId, setDefaultServiceId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [bomItems, setBomItems] = useState<{ product_id: string; quantity_per_procedure: number }[]>([]);
  const [bomProductId, setBomProductId] = useState("");
  const [bomQty, setBomQty] = useState("1");
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<Set<string>>(new Set());
  const [selectedFichaIds, setSelectedFichaIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [procedureToDelete, setProcedureToDelete] = useState<ProcedureRow | null>(null);

  const showForm = isNew || editingId !== null;

  function openNew() {
    setEditingId(null);
    setIsNew(true);
    setName("");
    setRecommendations("");
    setDefaultServiceId("");
    setDurationMinutes(30);
    setBomItems([]);
    setSelectedDoctorIds(new Set());
    setSelectedFichaIds([]);
    setError(null);
  }

  async function openEdit(p: ProcedureRow) {
    setIsNew(false);
    setEditingId(p.id);
    setName(p.name);
    setRecommendations(p.recommendations || "");
    setDefaultServiceId(p.default_service_id ?? "");
    setDurationMinutes(p.duration_minutes ?? 30);
    setSelectedDoctorIds(new Set(doctorIdsByProcedureId[p.id] ?? []));
    const bomRes = await getProcedureProducts(p.id);
    if (bomRes.error) {
      setError(bomRes.error);
      setBomItems([]);
    } else {
      setBomItems(
        bomRes.data.map((row: ProcedureProductRow) => ({
          product_id: row.product_id,
          quantity_per_procedure: row.quantity_per_procedure,
        }))
      );
    }
    const fichaRes = await getProcedureClinicalFichaIds(p.id);
    setSelectedFichaIds(fichaRes.error ? [] : fichaRes.data);
    setError(null);
  }

  function cancelForm() {
    setEditingId(null);
    setIsNew(false);
    setError(null);
    setBomItems([]);
    setBomProductId("");
    setBomQty("1");
    setSelectedFichaIds([]);
  }

  const toggleDoctor = (doctorId: string) => {
    setSelectedDoctorIds((prev) => {
      const next = new Set(prev);
      if (next.has(doctorId)) next.delete(doctorId);
      else next.add(doctorId);
      return next;
    });
  };

  const toggleFicha = (fichaId: string) => {
    setSelectedFichaIds((prev) =>
      prev.includes(fichaId) ? prev.filter((id) => id !== fichaId) : [...prev, fichaId]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (isNew) {
      const res = await createProcedure(name, recommendations || null, {
        default_service_id: defaultServiceId || null,
        duration_minutes: durationMinutes,
      });
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      const procedureId = (res as { procedureId?: string }).procedureId;
      if (procedureId) {
        const doctorSync =
          selectedDoctorIds.size > 0
            ? await syncDoctorProcedures(procedureId, [...selectedDoctorIds])
            : { error: null as string | null };
        const bomSync = await syncProcedureProducts(procedureId, bomItems);
        const fichaSync = await syncProcedureClinicalFichas(procedureId, selectedFichaIds);
        if (bomSync.error) {
          setError(bomSync.error);
          setLoading(false);
          return;
        }
        if (fichaSync.error) {
          setError(fichaSync.error);
          setLoading(false);
          return;
        }
        if (doctorSync.error) {
          setError(`Procedimento salvo, mas vínculo com médicos falhou: ${doctorSync.error}`);
          setLoading(false);
          return;
        }
      }
      cancelForm();
      onMutate();
      setLoading(false);
      return;
    }
    if (editingId) {
      const res = await updateProcedure(editingId, {
        name: name.trim(),
        recommendations: recommendations.trim() || null,
        default_service_id: defaultServiceId || null,
        duration_minutes: durationMinutes,
      });
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }
      const [doctorSync, bomSync, fichaSync] = await Promise.all([
        syncDoctorProcedures(editingId, [...selectedDoctorIds]),
        syncProcedureProducts(editingId, bomItems),
        syncProcedureClinicalFichas(editingId, selectedFichaIds),
      ]);
      if (bomSync.error) {
        setError(bomSync.error);
        setLoading(false);
        return;
      }
      if (fichaSync.error) {
        setError(fichaSync.error);
        setLoading(false);
        return;
      }
      if (doctorSync.error) {
        setError(`Insumos salvos, mas vínculo com médicos falhou: ${doctorSync.error}`);
        setLoading(false);
        return;
      }
      setProcedures((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? { ...p, name: name.trim(), recommendations: recommendations.trim() || null }
            : p
        )
      );
      cancelForm();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Lista de procedimentos</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Ex.: endoscopia, colonoscopia. Cada um tem recomendações padrão (usadas em e-mail e mensagens). Ao agendar, o procedimento pré-preenche as recomendações e pode auto-associar formulários vinculados a ele.
          </p>
        </div>
        {!showForm && (
          <Button variant="outline" onClick={openNew} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Novo procedimento
          </Button>
        )}
      </div>
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-lg border border-border bg-muted/30 space-y-4"
          >
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="proc_name">Nome *</Label>
              <Input
                id="proc_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Endoscopia"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proc_recommendations">Recomendações padrão</Label>
              <Textarea
                id="proc_recommendations"
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="Ex.: Jejum de 8h. Trazer exames anteriores..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Será usado em e-mails e mensagens; ao agendar com este procedimento, o campo de recomendações já virá preenchido.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Serviço padrão (cobrança)</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={defaultServiceId}
                  onChange={(e) => setDefaultServiceId(e.target.value)}
                >
                  <option value="">Nenhum</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Vincula o procedimento ao preço na aba Serviços e valores. Obrigatório para cobrança unificada na agenda.
                </p>
                {defaultServiceId && (
                  <p className="text-xs text-muted-foreground rounded-md bg-muted/40 px-2 py-1.5">
                    Recorrência:{" "}
                    <span className="font-medium text-foreground">
                      {recurrenceBillingModeLabel(
                        services.find((s) => s.id === defaultServiceId)
                          ?.recurrence_billing_mode ?? null
                      )}
                    </span>
                    <span className="block mt-0.5">
                      Definido no serviço na aba Serviços e valores.
                    </span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="proc_duration">Duração padrão (minutos)</Label>
                <Input
                  id="proc_duration"
                  type="number"
                  min={5}
                  max={480}
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(parseInt(e.target.value, 10) || 30)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Sugere o horário final na agenda. A secretária pode ajustar ao agendar.
                </p>
              </div>
            </div>
            {products.length > 0 && (
              <div className="space-y-2">
                <Label>Insumos do procedimento (BOM)</Label>
                <p className="text-xs text-muted-foreground">
                  Reservados no estoque ao agendar. Na cobrança, usa o preço de venda do produto (Estoque); se vazio, usa o custo.
                </p>
                {bomItems.length > 0 && (
                  <ul className="text-sm space-y-1 border rounded-md p-2">
                    {bomItems.map((item, idx) => {
                      const prod = products.find((p) => p.id === item.product_id);
                      return (
                        <li key={idx} className="flex justify-between items-center">
                          <span>{prod?.name ?? item.product_id} — {item.quantity_per_procedure} {prod?.unit}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setBomItems((prev) => prev.filter((_, i) => i !== idx))}>Remover</Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex gap-2">
                  <select
                    className="h-9 flex-1 rounded-md border px-2 text-sm"
                    value={bomProductId}
                    onChange={(e) => setBomProductId(e.target.value)}
                  >
                    <option value="">Produto…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <Input className="w-20 h-9" value={bomQty} onChange={(e) => setBomQty(e.target.value)} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!bomProductId) return;
                      setBomItems((prev) => [
                        ...prev.filter((i) => i.product_id !== bomProductId),
                        { product_id: bomProductId, quantity_per_procedure: parseFloat(bomQty) || 1 },
                      ]);
                      setBomProductId("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {fichaTemplates.length > 0 && (
              <div className="space-y-2">
                <Label>Fichas de atendimento</Label>
                <p className="text-xs text-muted-foreground">
                  Selecione quais fichas aparecem na sidebar do atendimento clínico para este procedimento.
                </p>
                <ul className="flex flex-wrap gap-2 mt-2">
                  {fichaTemplates.filter((f) => f.active).map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => toggleFicha(f.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors",
                          selectedFichaIds.includes(f.id)
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted/30 border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {selectedFichaIds.includes(f.id) ? (
                          <Check className="h-4 w-4" />
                        ) : null}
                        {f.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {doctors.length > 0 && (
              <div className="space-y-2">
                <Label>Profissionais que realizam este procedimento</Label>
                <p className="text-xs text-muted-foreground">
                  Usado no roteamento do chatbot WhatsApp: ao escolher "Agendar" e este procedimento, a conversa será encaminhada para a equipe de Secretário(a) desses profissionais.
                </p>
                <ul className="flex flex-wrap gap-2 mt-2">
                  {doctors.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => toggleDoctor(d.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors",
                          selectedDoctorIds.has(d.id)
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted/30 border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {selectedDoctorIds.has(d.id) ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <UserCircle className="h-4 w-4" />
                        )}
                        {d.full_name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" onClick={cancelForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando…" : isNew ? "Criar procedimento" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        )}

        {procedures.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm mb-1">Nenhum procedimento cadastrado</p>
            <p className="text-xs">Adicione procedimentos para usar na agenda (ex.: endoscopia)</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {procedures.map((p) => {
              const linkedDoctorIds = doctorIdsByProcedureId[p.id] ?? [];
              const linkedDoctors = doctors.filter((d) => linkedDoctorIds.includes(d.id));
              return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center justify-between py-3 first:pt-0",
                  editingId === p.id && "bg-muted/50 -mx-2 px-2 rounded"
                )}
              >
                <div>
                  <strong>{p.name}</strong>
                  {linkedDoctors.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Profissionais: {linkedDoctors.map((d) => d.full_name).join(", ")}
                    </p>
                  )}
                  {p.recommendations && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {p.recommendations}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(p)}
                    className="shrink-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setProcedureToDelete(p)}
                    className="text-destructive hover:text-destructive"
                    disabled={deletingId === p.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
            })}
          </ul>
        )}
      <ConfirmDialog
        open={!!procedureToDelete}
        title="Excluir procedimento"
        message={`Tem certeza que deseja excluir "${procedureToDelete?.name ?? ""}"?`}
        confirmLabel="Excluir"
        variant="destructive"
        loading={deletingId !== null}
        onCancel={() => setProcedureToDelete(null)}
        onConfirm={async () => {
          if (!procedureToDelete) return;
          setDeletingId(procedureToDelete.id);
          const res = await deleteProcedure(procedureToDelete.id);
          setDeletingId(null);
          if (res.error) {
            setError(res.error);
            return;
          }
          setProcedureToDelete(null);
          onMutate();
        }}
      />
    </div>
  );
}
