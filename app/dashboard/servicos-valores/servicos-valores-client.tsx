"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ServiceRow = { id: string; nome: string; categoria: string | null };
type DimensionRow = { id: string; nome: string; ativo: boolean };
type DimensionValueRow = { id: string; dimension_id: string; nome: string; ativo: boolean };
type ServicePriceRow = { id: string; service_id: string; professional_id: string | null; valor: number; ativo: boolean };
type DoctorRow = { id: string; full_name: string | null };

type Tab = "servicos" | "dimensoes" | "valores" | "regras";

export function ServicosValoresClient({
  services: initialServices,
  dimensions: initialDimensions,
  dimensionValues: initialDimensionValues,
  servicePrices: initialServicePrices,
  dimensionValueIdsByPriceId,
  doctors,
}: {
  services: ServiceRow[];
  dimensions: DimensionRow[];
  dimensionValues: DimensionValueRow[];
  servicePrices: ServicePriceRow[];
  dimensionValueIdsByPriceId: Record<string, string[]>;
  doctors: DoctorRow[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("servicos");

  const tabs: { id: Tab; label: string }[] = [
    { id: "servicos", label: "Serviços" },
    { id: "dimensoes", label: "Dimensões" },
    { id: "valores", label: "Valores por dimensão" },
    { id: "regras", label: "Regras de preço" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
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
        onMutate();
      }
    } else if (editingId) {
      const res = await updateService(editingId, nome, categoria);
      if (res.error) setError(res.error);
      else {
        setEditingId(null);
        setNome("");
        setCategoria("");
        onMutate();
      }
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este serviço? Regras de preço vinculadas podem ser afetadas.")) return;
    setError(null);
    const res = await deleteService(id);
    if (res.error) setError(res.error);
    else onMutate();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="font-semibold">Serviços (ex.: Consulta geral, Botox, Colonoscopia)</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setIsNew(true);
            setEditingId(null);
            setNome("");
            setCategoria("");
          }}
          disabled={isNew}
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(isNew || editingId) && (
          <div className="flex flex-wrap gap-2 items-end p-3 rounded-md bg-muted/50">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Consulta geral"
                className="w-48"
              />
            </div>
            <div className="space-y-1">
              <Label>Categoria (opcional)</Label>
              <Input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex.: Clínica"
                className="w-40"
              />
            </div>
            <Button size="sm" onClick={handleSave} disabled={loading || !nome.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
            <Button
              size="sm"
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
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2">Nome</th>
                <th className="text-left p-2">Categoria</th>
                <th className="w-24 p-2" />
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-b">
                  {editingId === s.id ? (
                    <>
                      <td className="p-2">
                        <Input
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          className="h-8 w-48"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={categoria}
                          onChange={(e) => setCategoria(e.target.value)}
                          className="h-8 w-40"
                        />
                      </td>
                      <td className="p-2">
                        <Button size="sm" onClick={handleSave} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ok"}
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">{s.nome}</td>
                      <td className="p-2 text-muted-foreground">{s.categoria ?? "—"}</td>
                      <td className="p-2 flex gap-1">
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
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(s.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
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
        onMutate();
      }
    } else if (editingId) {
      const res = await updateDimension(editingId, nome, ativo);
      if (res.error) setError(res.error);
      else {
        setEditingId(null);
        setNome("");
        setAtivo(true);
        onMutate();
      }
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta dimensão? Os valores vinculados também serão removidos das regras.")) return;
    setError(null);
    const res = await deleteDimension(id);
    if (res.error) setError(res.error);
    else onMutate();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="font-semibold">Dimensões (ex.: Cidade, Convênio, Unidade, Turno, Campanha)</h2>
        <Button size="sm" variant="outline" onClick={() => { setIsNew(true); setEditingId(null); setNome(""); }} disabled={isNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isNew && (
          <div className="flex flex-wrap gap-2 items-end p-3 rounded-md bg-muted/50">
            <div className="space-y-1">
              <Label>Nome da dimensão</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Convênio" className="w-48" />
            </div>
            <Button size="sm" onClick={handleSave} disabled={loading || !nome.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsNew(false); setNome(""); }}>Cancelar</Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2">Nome</th>
                <th className="text-left p-2">Ativo</th>
                <th className="w-24 p-2" />
              </tr>
            </thead>
            <tbody>
              {dimensions.map((d) => (
                <tr key={d.id} className="border-b">
                  {editingId === d.id ? (
                    <>
                      <td className="p-2">
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-8 w-48" />
                      </td>
                      <td className="p-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                          Ativo
                        </label>
                      </td>
                      <td className="p-2">
                        <Button size="sm" onClick={handleSave} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ok"}
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">{d.nome}</td>
                      <td className="p-2">{d.ativo ? "Sim" : "Não"}</td>
                      <td className="p-2 flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(d.id); setNome(d.nome); setAtivo(d.ativo); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(d.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
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

  useEffect(() => setValues(initialDimensionValues), [initialDimensionValues]);

  const valuesByDimension = dimensions.map((dim) => ({
    ...dim,
    values: values.filter((v) => v.dimension_id === dim.id),
  }));

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
        onMutate();
      }
    } else if (editingId) {
      const res = await updateDimensionValue(editingId, nome, ativo);
      if (res.error) setError(res.error);
      else {
        setEditingId(null);
        setNome("");
        setAtivo(true);
        onMutate();
      }
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este valor?")) return;
    setError(null);
    const res = await deleteDimensionValue(id);
    if (res.error) setError(res.error);
    else onMutate();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="font-semibold">Valores de cada dimensão (ex.: Unimed, SUS, Particular para Convênio)</h2>
        <div className="flex gap-2 items-center">
          <select
            value={dimensionId}
            onChange={(e) => setDimensionId(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Selecione a dimensão</option>
            {dimensions.filter((d) => d.ativo).map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setIsNew(true); setEditingId(null); setNome(""); }}
            disabled={isNew || !dimensionId}
          >
            <Plus className="h-4 w-4 mr-1" /> Novo valor
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isNew && dimensionId && (
          <div className="flex flex-wrap gap-2 items-end p-3 rounded-md bg-muted/50">
            <div className="space-y-1">
              <Label>Nome do valor</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Unimed" className="w-48" />
            </div>
            <Button size="sm" onClick={handleSave} disabled={loading || !nome.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsNew(false); setDimensionId(""); setNome(""); }}>Cancelar</Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-4">
          {valuesByDimension.map((dim) => (
            <div key={dim.id} className="rounded-md border p-3">
              <h3 className="font-medium text-sm mb-2">{dim.nome}</h3>
              <div className="flex flex-wrap gap-2">
                {dim.values.map((v) =>
                  editingId === v.id ? (
                    <div key={v.id} className="flex items-center gap-2 rounded border px-2 py-1 bg-muted/50">
                      <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-8 w-32" />
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                        Ativo
                      </label>
                      <Button size="sm" onClick={handleSave} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ok"}
                      </Button>
                    </div>
                  ) : (
                    <div key={v.id} className="flex items-center gap-1 rounded border px-2 py-1 bg-background">
                      <span className="text-sm">{v.nome}</span>
                      {!v.ativo && <span className="text-xs text-muted-foreground">(inativo)</span>}
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingId(v.id); setNome(v.nome); setAtivo(v.ativo); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDelete(v.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                )}
                {dim.values.length === 0 && <span className="text-sm text-muted-foreground">Nenhum valor cadastrado.</span>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
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
  onMutate,
}: {
  services: ServiceRow[];
  dimensions: DimensionRow[];
  dimensionValues: DimensionValueRow[];
  servicePrices: ServicePriceRow[];
  dimensionValueIdsByPriceId: Record<string, string[]>;
  doctors: DoctorRow[];
  onMutate: () => void;
}) {
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
    if (isNew) {
      const res = await createServicePrice(serviceId, professionalId || null, numValor, selectedDimensionValueIds);
      if (res.error) setError(res.error);
      else {
        setIsNew(false);
        setServiceId("");
        setProfessionalId("");
        setValor("");
        setSelectedDimensionValueIds([]);
        onMutate();
      }
    } else if (editingId) {
      const res = await updateServicePrice(editingId, serviceId, professionalId || null, numValor, ativo, selectedDimensionValueIds);
      if (res.error) setError(res.error);
      else {
        setEditingId(null);
        setServiceId("");
        setProfessionalId("");
        setValor("");
        setSelectedDimensionValueIds([]);
        setAtivo(true);
        onMutate();
      }
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta regra de preço?")) return;
    setError(null);
    const res = await deleteServicePrice(id);
    if (res.error) setError(res.error);
    else onMutate();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="font-semibold">Regras de preço (serviço + opcionalmente médico + dimensões = valor)</h2>
        <Button size="sm" variant="outline" onClick={() => { setIsNew(true); setEditingId(null); setServiceId(""); setProfessionalId(""); setValor(""); setSelectedDimensionValueIds([]); }} disabled={isNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova regra
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(isNew || editingId) && (
          <div className="p-4 rounded-md bg-muted/50 space-y-3">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label>Serviço *</Label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm min-w-[180px]"
                >
                  <option value="">Selecione</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Médico (opcional)</Label>
                <select
                  value={professionalId}
                  onChange={(e) => setProfessionalId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm min-w-[180px]"
                >
                  <option value="">Qualquer</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name ?? d.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Valor (R$) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="w-28"
                />
              </div>
              {editingId && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                  Ativo
                </label>
              )}
            </div>
            <div>
              <Label className="mb-2 block">Dimensões que compõem esta regra (ex.: Unimed + Cidade X)</Label>
              <div className="flex flex-wrap gap-2">
                {byDimension.map((dim) => (
                  <div key={dim.id} className="rounded border p-2 min-w-[140px]">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{dim.nome}</p>
                    {dim.values.map((v) => (
                      <label key={v.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedDimensionValueIds.includes(v.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedDimensionValueIds((ids) => [...ids, v.id]);
                            else setSelectedDimensionValueIds((ids) => ids.filter((id) => id !== v.id));
                          }}
                        />
                        {v.nome}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setIsNew(false); setEditingId(null); setServiceId(""); setProfessionalId(""); setValor(""); setSelectedDimensionValueIds([]); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2">Serviço</th>
                <th className="text-left p-2">Médico</th>
                <th className="text-left p-2">Valor</th>
                <th className="text-left p-2">Dimensões</th>
                <th className="text-left p-2">Ativo</th>
                <th className="w-24 p-2" />
              </tr>
            </thead>
            <tbody>
              {servicePrices.map((p) => {
                const service = services.find((s) => s.id === p.service_id);
                const professional = doctors.find((d) => d.id === p.professional_id);
                const dvIds = dimensionValueIdsByPriceId[p.id] ?? [];
                return (
                  <tr key={p.id} className="border-b">
                    <td className="p-2">{service?.nome ?? p.service_id.slice(0, 8)}</td>
                    <td className="p-2">{professional ? (professional.full_name ?? professional.id.slice(0, 8)) : "—"}</td>
                    <td className="p-2">{formatCurrency(Number(p.valor))}</td>
                    <td className="p-2">
                      {dvIds.length
                        ? dvIds.map((id) => `${getDimensionNameForValue(id)}: ${getValueLabel(id)}`).join(" · ")
                        : "—"}
                    </td>
                    <td className="p-2">{p.ativo ? "Sim" : "Não"}</td>
                    <td className="p-2 flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingId(p.id);
                          setIsNew(false);
                          setServiceId(p.service_id);
                          setProfessionalId(p.professional_id ?? "");
                          setValor(String(p.valor));
                          setSelectedDimensionValueIds(dimensionValueIdsByPriceId[p.id] ?? []);
                          setAtivo(p.ativo);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
