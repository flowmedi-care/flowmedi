"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  createService,
  updateService,
  deleteService,
  createDimension,
  updateDimension,
  deleteDimension,
  createDimensionValue,
  updateDimensionValue,
  deleteDimensionValue,
  createServicePrice,
  updateServicePrice,
  deleteServicePrice,
} from "./actions";
import { Plus, Pencil, Trash2, Loader2, Briefcase, Sliders, ListChecks, Calculator, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type ServiceRow = { id: string; nome: string; categoria: string | null };
type DimensionRow = { id: string; nome: string; ativo: boolean };
type DimensionValueRow = { id: string; dimension_id: string; nome: string; ativo: boolean };
type ServicePriceRow = { id: string; service_id: string; professional_id: string | null; valor: number; ativo: boolean };
type DoctorRow = { id: string; full_name: string | null };

type Tab = "servicos" | "dimensoes" | "valores" | "regras";

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border border-dashed border-border bg-muted/20">
      <Icon className="h-10 w-10 text-muted-foreground mb-3" aria-hidden />
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">{description}</p>
      <Button variant="outline" size="sm" onClick={onAction}>
        <Plus className="h-4 w-4 mr-2" />
        {actionLabel}
      </Button>
    </div>
  );
}

export function ServicosValoresClient({
  services: initialServices,
  dimensions: initialDimensions,
  dimensionValues: initialDimensionValues,
  servicePrices: initialServicePrices,
  dimensionValueIdsByPriceId,
  doctors,
  currentUserId,
  currentUserRole,
}: {
  services: ServiceRow[];
  dimensions: DimensionRow[];
  dimensionValues: DimensionValueRow[];
  servicePrices: ServicePriceRow[];
  dimensionValueIdsByPriceId: Record<string, string[]>;
  doctors: DoctorRow[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("servicos");

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "servicos", label: "Serviços", icon: Briefcase },
    { id: "dimensoes", label: "Dimensões", icon: Sliders },
    { id: "valores", label: "Valores por dimensão", icon: ListChecks },
    { id: "regras", label: "Regras de preço", icon: Calculator },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-border">
        <nav className="flex gap-1 overflow-x-auto scrollbar-thin" aria-label="Abas">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-[320px]">
        {activeTab === "servicos" && (
          <ServicosSection
            initialServices={initialServices}
            onMutate={() => router.refresh()}
          />
        )}
        {activeTab === "dimensoes" && (
          <DimensoesSection
            initialDimensions={initialDimensions}
            onMutate={() => router.refresh()}
          />
        )}
        {activeTab === "valores" && (
          <ValoresSection
            dimensions={initialDimensions}
            initialDimensionValues={initialDimensionValues}
            onMutate={() => router.refresh()}
          />
        )}
        {activeTab === "regras" && (
          <RegrasSection
            services={initialServices}
            dimensions={initialDimensions}
            dimensionValues={initialDimensionValues}
            servicePrices={initialServicePrices}
            dimensionValueIdsByPriceId={dimensionValueIdsByPriceId}
            doctors={doctors}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onMutate={() => router.refresh()}
          />
        )}
      </div>
    </div>
  );
}

function ServicosSection({
  initialServices,
  onMutate,
}: {
  initialServices: ServiceRow[];
  onMutate: () => void;
}) {
  const [services, setServices] = useState<ServiceRow[]>(initialServices);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => setServices(initialServices), [initialServices]);

  async function handleSave() {
    setError(null);
    setLoading(true);
    if (isNew) {
      const res = await createService(nome, categoria);
      if (res.error) setError(res.error);
      else {
        setIsNew(false);
        setNome("");
        setCategoria("");
        toast("Serviço criado com sucesso.", "success");
        onMutate();
      }
    } else if (editingId) {
      const res = await updateService(editingId, nome, categoria);
      if (res.error) setError(res.error);
      else {
        setEditingId(null);
        setNome("");
        setCategoria("");
        toast("Serviço atualizado.", "success");
        onMutate();
      }
    }
    setLoading(false);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError(null);
    const res = await deleteService(deleteTarget.id);
    setDeleteLoading(false);
    setDeleteTarget(null);
    if (res.error) setError(res.error);
    else {
      toast("Serviço excluído.", "success");
      onMutate();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <h2 className="text-lg font-semibold">Serviços</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Ex.: Consulta geral, Botox, Colonoscopia</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setIsNew(true);
            setEditingId(null);
            setNome("");
            setCategoria("");
          }}
          disabled={isNew}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo serviço
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(isNew || editingId) && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nome</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Consulta geral"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Categoria (opcional)</Label>
                <Input
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Ex.: Clínica"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading || !nome.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsNew(false);
                  setEditingId(null);
                  setNome("");
                  setCategoria("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>}
        {services.length === 0 && !isNew && !editingId ? (
          <EmptyState
            icon={Inbox}
            title="Nenhum serviço cadastrado"
            description="Cadastre os serviços oferecidos pela clínica para configurar preços e usar na agenda."
            actionLabel="Adicionar primeiro serviço"
            onAction={() => { setIsNew(true); setNome(""); setCategoria(""); }}
          />
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoria</th>
                  <th className="w-[100px] py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                    {editingId === s.id ? (
                      <>
                        <td className="py-3 px-4">
                          <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-9 max-w-xs" />
                        </td>
                        <td className="py-3 px-4">
                          <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-9 max-w-[180px]" />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" onClick={handleSave} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 font-medium">{s.nome}</td>
                        <td className="py-3 px-4 text-muted-foreground">{s.categoria ?? "—"}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingId(s.id);
                                setIsNew(false);
                                setNome(s.nome);
                                setCategoria(s.categoria ?? "");
                              }}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget({ id: s.id, nome: s.nome })}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir serviço"
        message={deleteTarget ? `Excluir "${deleteTarget.nome}"? Regras de preço vinculadas podem ser afetadas.` : ""}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}

function DimensoesSection({
  initialDimensions,
  onMutate,
}: {
  initialDimensions: DimensionRow[];
  onMutate: () => void;
}) {
  const [dimensions, setDimensions] = useState<DimensionRow[]>(initialDimensions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => setDimensions(initialDimensions), [initialDimensions]);

  async function handleSave() {
    setError(null);
    setLoading(true);
    if (isNew) {
      const res = await createDimension(nome);
      if (res.error) setError(res.error);
      else {
        setIsNew(false);
        setNome("");
        toast("Dimensão criada.", "success");
        onMutate();
      }
    } else if (editingId) {
      const res = await updateDimension(editingId, nome, ativo);
      if (res.error) setError(res.error);
      else {
        setEditingId(null);
        setNome("");
        setAtivo(true);
        toast("Dimensão atualizada.", "success");
        onMutate();
      }
    }
    setLoading(false);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError(null);
    const res = await deleteDimension(deleteTarget.id);
    setDeleteLoading(false);
    setDeleteTarget(null);
    if (res.error) setError(res.error);
    else {
      toast("Dimensão excluída.", "success");
      onMutate();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <h2 className="text-lg font-semibold">Dimensões</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Ex.: Cidade, Convênio, Unidade, Turno, Campanha</p>
        </div>
        <Button size="sm" onClick={() => { setIsNew(true); setEditingId(null); setNome(""); }} disabled={isNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova dimensão
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isNew && (
          <div className="rounded-lg border bg-muted/30 p-4 flex flex-wrap items-end gap-4">
            <div className="space-y-2 min-w-[200px]">
              <Label className="text-sm font-medium">Nome da dimensão</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Convênio" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading || !nome.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => { setIsNew(false); setNome(""); }}>Cancelar</Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>}
        {dimensions.length === 0 && !isNew ? (
          <EmptyState
            icon={Sliders}
            title="Nenhuma dimensão cadastrada"
            description="Crie dimensões para diferenciar preços (convênio, cidade, turno, etc.)."
            actionLabel="Adicionar primeira dimensão"
            onAction={() => { setIsNew(true); setNome(""); }}
          />
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ativo</th>
                  <th className="w-[100px] py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {dimensions.map((d) => (
                  <tr key={d.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                    {editingId === d.id ? (
                      <>
                        <td className="py-3 px-4">
                          <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-9 max-w-xs" />
                        </td>
                        <td className="py-3 px-4">
                          <Switch checked={ativo} onChange={setAtivo} label="Ativo" />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" onClick={handleSave} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 font-medium">{d.nome}</td>
                        <td className="py-3 px-4">
                          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", d.ativo ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground")}>
                            {d.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(d.id); setNome(d.nome); setAtivo(d.ativo); }} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: d.id, nome: d.nome })} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir dimensão"
        message={deleteTarget ? `Excluir "${deleteTarget.nome}"? Os valores vinculados serão removidos das regras.` : ""}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}

function ValoresSection({
  dimensions,
  initialDimensionValues,
  onMutate,
}: {
  dimensions: DimensionRow[];
  initialDimensionValues: DimensionValueRow[];
  onMutate: () => void;
}) {
  const [values, setValues] = useState<DimensionValueRow[]>(initialDimensionValues);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [dimensionId, setDimensionId] = useState("");
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => setValues(initialDimensionValues), [initialDimensionValues]);

  const valuesByDimension = dimensions.map((dim) => ({
    ...dim,
    values: values.filter((v) => v.dimension_id === dim.id),
  }));
  const activeDimensions = dimensions.filter((d) => d.ativo);

  async function handleSave() {
    setError(null);
    setLoading(true);
    if (isNew && dimensionId) {
      const res = await createDimensionValue(dimensionId, nome);
      if (res.error) setError(res.error);
      else {
        setIsNew(false);
        setDimensionId("");
        setNome("");
        toast("Valor adicionado.", "success");
        onMutate();
      }
    } else if (editingId) {
      const res = await updateDimensionValue(editingId, nome, ativo);
      if (res.error) setError(res.error);
      else {
        setEditingId(null);
        setNome("");
        setAtivo(true);
        toast("Valor atualizado.", "success");
        onMutate();
      }
    }
    setLoading(false);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError(null);
    const res = await deleteDimensionValue(deleteTarget.id);
    setDeleteLoading(false);
    setDeleteTarget(null);
    if (res.error) setError(res.error);
    else {
      toast("Valor excluído.", "success");
      onMutate();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <h2 className="text-lg font-semibold">Valores por dimensão</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Ex.: Unimed, SUS, Particular para Convênio</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={dimensionId}
            onChange={(e) => setDimensionId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[180px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">Selecione a dimensão</option>
            {activeDimensions.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>
          <Button size="sm" onClick={() => { setIsNew(true); setEditingId(null); setNome(""); }} disabled={isNew || !dimensionId}>
            <Plus className="h-4 w-4 mr-2" />
            Novo valor
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isNew && dimensionId && (
          <div className="rounded-lg border bg-muted/30 p-4 flex flex-wrap items-end gap-4">
            <div className="space-y-2 min-w-[200px]">
              <Label className="text-sm font-medium">Nome do valor</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Unimed" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading || !nome.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => { setIsNew(false); setDimensionId(""); setNome(""); }}>Cancelar</Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>}
        {activeDimensions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 px-4 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Cadastre dimensões na aba &quot;Dimensões&quot; para adicionar valores.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {valuesByDimension.filter((d) => d.ativo).map((dim) => (
              <div key={dim.id} className="rounded-lg border p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">{dim.nome}</h3>
                <div className="flex flex-wrap gap-2">
                  {dim.values.map((v) =>
                    editingId === v.id ? (
                      <div key={v.id} className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-8 w-32" />
                        <Switch checked={ativo} onChange={setAtivo} label="Ativo" />
                        <Button size="sm" onClick={handleSave} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                        </Button>
                      </div>
                    ) : (
                      <div
                        key={v.id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm",
                          v.ativo ? "bg-background border-border" : "bg-muted/30 border-muted text-muted-foreground"
                        )}
                      >
                        <span>{v.nome}</span>
                        {!v.ativo && <span className="text-xs">(inativo)</span>}
                        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { setEditingId(v.id); setNome(v.nome); setAtivo(v.ativo); }} title="Editar">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: v.id, nome: v.nome })} title="Excluir">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )
                  )}
                  {dim.values.length === 0 && (
                    <span className="text-sm text-muted-foreground py-1">Nenhum valor. Selecione esta dimensão acima e clique em &quot;Novo valor&quot;.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir valor"
        message={deleteTarget ? `Excluir "${deleteTarget.nome}"?` : ""}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}

function RegrasSection({
  services,
  dimensions,
  dimensionValues,
  servicePrices,
  dimensionValueIdsByPriceId,
  doctors,
  currentUserId,
  currentUserRole,
  onMutate,
}: {
  services: ServiceRow[];
  dimensions: DimensionRow[];
  dimensionValues: DimensionValueRow[];
  servicePrices: ServicePriceRow[];
  dimensionValueIdsByPriceId: Record<string, string[]>;
  doctors: DoctorRow[];
  currentUserId: string;
  currentUserRole: string;
  onMutate: () => void;
}) {
  const isMedico = currentUserRole === "medico";
  const [isNew, setIsNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [valor, setValor] = useState("");
  const [selectedDimensionValueIds, setSelectedDimensionValueIds] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDimensionValues = dimensionValues.filter((v) => v.ativo);
  const byDimension = dimensions.filter((d) => d.ativo).map((d) => ({
    ...d,
    values: activeDimensionValues.filter((v) => v.dimension_id === d.id),
  }));

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  }

  function getValueLabel(id: string) {
    return dimensionValues.find((v) => v.id === id)?.nome ?? id;
  }

  function getDimensionNameForValue(dvId: string) {
    const dv = dimensionValues.find((v) => v.id === dvId);
    if (!dv) return "";
    return dimensions.find((d) => d.id === dv.dimension_id)?.nome ?? "";
  }

  async function handleSave() {
    setError(null);
    const numValor = parseFloat(valor.replace(",", "."));
    if (isNaN(numValor) || numValor < 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (!serviceId) {
      setError("Selecione o serviço.");
      return;
    }
    setLoading(true);
    const effectiveProfessionalId = isMedico ? currentUserId : (professionalId || null);
    if (isNew) {
      const res = await createServicePrice(serviceId, effectiveProfessionalId, numValor, selectedDimensionValueIds);
      if (res.error) setError(res.error);
      else {
        setIsNew(false);
        setServiceId("");
        setProfessionalId("");
        setValor("");
        setSelectedDimensionValueIds([]);
        toast("Regra de preço criada.", "success");
        onMutate();
      }
    } else if (editingId) {
      const res = await updateServicePrice(editingId, serviceId, effectiveProfessionalId, numValor, ativo, selectedDimensionValueIds);
      if (res.error) setError(res.error);
      else {
        setEditingId(null);
        setServiceId("");
        setProfessionalId("");
        setValor("");
        setSelectedDimensionValueIds([]);
        setAtivo(true);
        toast("Regra de preço atualizada.", "success");
        onMutate();
      }
    }
    setLoading(false);
  }

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError(null);
    const res = await deleteServicePrice(deleteTarget.id);
    setDeleteLoading(false);
    setDeleteTarget(null);
    if (res.error) setError(res.error);
    else {
      toast("Regra de preço excluída.", "success");
      onMutate();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <h2 className="text-lg font-semibold">Regras de preço</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Serviço + opcionalmente médico + dimensões = valor aplicado na agenda</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setIsNew(true);
            setEditingId(null);
            setServiceId("");
            setProfessionalId(isMedico ? currentUserId : "");
            setValor("");
            setSelectedDimensionValueIds([]);
          }}
          disabled={isNew}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova regra
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(isNew || editingId) && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <div className={cn("grid gap-4", isMedico ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")}>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Serviço *</Label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Selecione</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
              {!isMedico && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Médico (opcional)</Label>
                  <select
                    value={professionalId}
                    onChange={(e) => setProfessionalId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Qualquer</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>{d.full_name ?? d.id.slice(0, 8)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Valor (R$) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="h-10"
                />
              </div>
              {editingId && (
                <div className="space-y-2 flex items-end pb-2">
                  <Switch checked={ativo} onChange={setAtivo} label="Regra ativa" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Dimensões (ex.: Unimed + Cidade X)</Label>
              <div className="flex flex-wrap gap-3">
                {byDimension.map((dim) => (
                  <div key={dim.id} className="rounded-lg border bg-background p-3 min-w-[160px]">
                    <p className="text-xs font-medium text-muted-foreground mb-2">{dim.nome}</p>
                    <div className="space-y-1.5">
                      {dim.values.map((v) => (
                        <label key={v.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedDimensionValueIds.includes(v.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedDimensionValueIds((ids) => [...ids, v.id]);
                              else setSelectedDimensionValueIds((ids) => ids.filter((id) => id !== v.id));
                            }}
                            className="rounded border-input"
                          />
                          {v.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setIsNew(false); setEditingId(null); setServiceId(""); setProfessionalId(""); setValor(""); setSelectedDimensionValueIds([]); }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>}
        {servicePrices.length === 0 && !isNew && !editingId ? (
          <EmptyState
            icon={Calculator}
            title="Nenhuma regra de preço"
            description="Crie regras para definir quanto cobrar por serviço conforme dimensões (convênio, cidade, etc.)."
            actionLabel="Adicionar primeira regra"
            onAction={() => { setIsNew(true); setServiceId(""); setProfessionalId(""); setValor(""); setSelectedDimensionValueIds([]); }}
          />
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Serviço</th>
                  {!isMedico && (
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Médico</th>
                  )}
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Dimensões</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ativo</th>
                  <th className="w-[100px] py-3 px-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {servicePrices.map((p) => {
                  const service = services.find((s) => s.id === p.service_id);
                  const professional = doctors.find((d) => d.id === p.professional_id);
                  const dvIds = dimensionValueIdsByPriceId[p.id] ?? [];
                  const label = [service?.nome, formatCurrency(Number(p.valor))].filter(Boolean).join(" · ");
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium">{service?.nome ?? "—"}</td>
                      {!isMedico && (
                        <td className="py-3 px-4 text-muted-foreground">{professional ? (professional.full_name ?? "—") : "Qualquer"}</td>
                      )}
                      <td className="py-3 px-4">{formatCurrency(Number(p.valor))}</td>
                      <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate" title={dvIds.length ? dvIds.map((id) => `${getDimensionNameForValue(id)}: ${getValueLabel(id)}`).join(" · ") : undefined}>
                        {dvIds.length ? dvIds.map((id) => `${getDimensionNameForValue(id)}: ${getValueLabel(id)}`).join(" · ") : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", p.ativo ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground")}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingId(p.id);
                              setIsNew(false);
                              setServiceId(p.service_id);
                              setProfessionalId(isMedico ? currentUserId : (p.professional_id ?? ""));
                              setValor(String(p.valor));
                              setSelectedDimensionValueIds(dimensionValueIdsByPriceId[p.id] ?? []);
                              setAtivo(p.ativo);
                            }}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget({ id: p.id, label })}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir regra de preço"
        message={deleteTarget ? `Excluir a regra "${deleteTarget.label}"?` : ""}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}
