"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  getAppointmentConsumption,
  addConsumptionLine,
  updateConsumptionQuantity,
  removeConsumptionLine,
  finishClinicalEncounter,
  emitComanda,
  getBillingPreview,
  getClinicBillingDefaults,
  beginAppointmentCare,
  type ConsumptionLine,
  type BillingPreview,
  type ComandaDetail,
  type AppointmentComandaSummary,
} from "../../encounter-actions";
import { listProductsForClinic } from "@/app/dashboard/campos-pacientes/actions";
import { toast } from "@/components/ui/toast";
import { Trash2, Plus, Package, AlertTriangle, CheckCircle2, CreditCard } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ENCOUNTER_LABEL: Record<string, string> = {
  em_andamento: "Em atendimento",
  finalizado_aguardando_cobranca: "Aguardando comanda",
  cobrado: "Quitado",
};

export function AtendimentoClient({
  appointmentId,
  appointmentValor,
  canEdit,
  autoFinalize = false,
  autoStart = false,
  mode = "full",
}: {
  appointmentId: string;
  appointmentValor: number | null;
  canEdit: boolean;
  autoFinalize?: boolean;
  autoStart?: boolean;
  mode?: "full" | "billing-only";
}) {
  const router = useRouter();
  const [lines, setLines] = useState<ConsumptionLine[]>([]);
  const [encounterStatus, setEncounterStatus] = useState<string | null>(null);
  const [stockConsumed, setStockConsumed] = useState(false);
  const [comanda, setComanda] = useState<AppointmentComandaSummary | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicalAttentionOpen, setClinicalAttentionOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [emitOpen, setEmitOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [billingPreview, setBillingPreview] = useState<BillingPreview | null>(null);
  const [savedComanda, setSavedComanda] = useState<ComandaDetail | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [finishingClinical, setFinishingClinical] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [chargeMaterials, setChargeMaterials] = useState(true);
  const [discountMode, setDiscountMode] = useState<"none" | "amount" | "percent">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [autoStarting, setAutoStarting] = useState(false);
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getAppointmentConsumption(appointmentId);
    if (res.error) {
      toast(res.error, "error");
    } else {
      setLines(res.data);
      setEncounterStatus(res.encounter?.status ?? null);
      setStockConsumed(!!res.encounter?.stock_consumed_at);
      setComanda(res.comanda ?? null);
    }
    const prods = await listProductsForClinic();
    if (!prods.error) setProducts(prods.data);
    setLoading(false);
  }, [appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoStart || loading || !canEdit || autoStartAttempted) return;
    if (encounterStatus) return;
    setAutoStartAttempted(true);
    setAutoStarting(true);
    beginAppointmentCare(appointmentId).then((res) => {
      setAutoStarting(false);
      if (res.error && !res.error.includes("já foi iniciada")) {
        toast(res.error, "error");
      } else if (!res.error || res.error.includes("já foi iniciada")) {
        toast("Atendimento iniciado.", "success");
        load();
        router.refresh();
      }
    });
  }, [
    autoStart,
    loading,
    canEdit,
    encounterStatus,
    autoStartAttempted,
    appointmentId,
    load,
    router,
  ]);

  useEffect(() => {
    if (!autoFinalize || loading || !canEdit) return;
    if (mode === "billing-only" || encounterStatus === "finalizado_aguardando_cobranca") {
      if (!comanda?.issued_at) openEmitModal();
    } else if (encounterStatus !== "cobrado") {
      setClinicalAttentionOpen(true);
    }
  }, [autoFinalize, loading, canEdit, encounterStatus, comanda, mode]);

  const isClinicalLocked =
    encounterStatus === "finalizado_aguardando_cobranca" || encounterStatus === "cobrado";
  const isFullyPaid = encounterStatus === "cobrado";
  const canEditConsumption = canEdit && !isClinicalLocked;
  const canFinishClinical = canEdit && encounterStatus === "em_andamento";
  const isComandaFinalized = !!comanda?.issued_at;
  const canEmitComanda =
    canEdit && encounterStatus === "finalizado_aguardando_cobranca" && !isComandaFinalized;
  const committedUnits = lines.reduce((s, l) => s + l.quantity, 0);

  async function handleStartEncounter() {
    const res = await beginAppointmentCare(appointmentId);
    if (res.error) toast(res.error, "error");
    else {
      toast("Atendimento iniciado.", "success");
      load();
    }
  }

  async function handleAddLine() {
    if (!addProductId) return;
    const res = await addConsumptionLine(appointmentId, addProductId, parseFloat(addQty) || 1);
    if (res.error) toast(res.error, "error");
    else {
      setAddProductId("");
      load();
    }
  }

  function startClinicalFinishFlow() {
    setClinicalAttentionOpen(true);
  }

  function confirmClinicalAttention() {
    setClinicalAttentionOpen(false);
    setMaterialsOpen(true);
  }

  async function handleFinishClinical() {
    setFinishingClinical(true);
    const res = await finishClinicalEncounter(appointmentId);
    setFinishingClinical(false);
    setMaterialsOpen(false);
    if (res.error) toast(res.error, "error");
    else {
      toast("Atendimento clínico encerrado. Estoque consumido.", "success");
      router.refresh();
      load();
    }
  }

  async function refreshPreview(opts?: {
    chargeMaterialsSeparately?: boolean;
    discountAmount?: number;
    discountPercent?: number;
  }) {
    const res = await getBillingPreview(appointmentId, opts);
    if (res.error) {
      toast(res.error, "error");
      return null;
    }
    if (res.data) setBillingPreview(res.data);
    return res.data;
  }

  async function openEmitModal() {
    setEmitOpen(true);
    setLoadingBilling(true);
    setPaymentAmount("");
    setPaymentExpanded(false);
    setDiscountMode("none");
    setDiscountValue("");
    setNotes("");

    const defaults = await getClinicBillingDefaults();
    const charge = defaults.chargeMaterialsSeparately;
    setChargeMaterials(charge);

    await refreshPreview({ chargeMaterialsSeparately: charge });
    setLoadingBilling(false);
  }

  async function handleChargeMaterialsChange(checked: boolean) {
    setChargeMaterials(checked);
    setLoadingBilling(true);
    await refreshPreview(buildPreviewOptions(checked));
    setLoadingBilling(false);
  }

  async function handleDiscountChange(mode: "none" | "amount" | "percent", value: string) {
    setDiscountMode(mode);
    setDiscountValue(value);
    setLoadingBilling(true);
    await refreshPreview(buildPreviewOptions(chargeMaterials, mode, value));
    setLoadingBilling(false);
  }

  function buildPreviewOptions(
    materials: boolean,
    mode = discountMode,
    value = discountValue
  ) {
    const opts: {
      chargeMaterialsSeparately?: boolean;
      discountAmount?: number;
      discountPercent?: number;
    } = { chargeMaterialsSeparately: materials };
    const parsed = parseFloat(value.replace(",", ".")) || 0;
    if (mode === "amount" && parsed > 0) opts.discountAmount = parsed;
    if (mode === "percent" && parsed > 0) opts.discountPercent = parsed;
    return opts;
  }

  function buildEmitOptions(payment: number) {
    const opts: Parameters<typeof emitComanda>[1] = {
      chargeMaterialsSeparately: chargeMaterials,
      notes: notes.trim() || null,
      paymentAmount: payment,
      paymentMethod: payment > 0 ? paymentMethod : undefined,
    };
    const parsed = parseFloat(discountValue.replace(",", ".")) || 0;
    if (discountMode === "amount" && parsed > 0) opts.discountAmount = parsed;
    if (discountMode === "percent" && parsed > 0) opts.discountPercent = parsed;
    return opts;
  }

  async function handleEmit(paymentOverride?: number) {
    const payment =
      paymentOverride ?? (parseFloat(paymentAmount.replace(",", ".")) || 0);
    setEmitting(true);
    const res = await emitComanda(appointmentId, buildEmitOptions(payment));
    setEmitting(false);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
      toast(
      payment > 0 ? "Cupom emitido e pagamento registrado." : "Cupom emitido.",
      "success"
    );
    setEmitOpen(false);
    if (res.comanda) {
      setSavedComanda(res.comanda);
      setSummaryOpen(true);
    }
    router.refresh();
    load();
  }

  const showConsumption = mode === "full";
  const showClinicalCard = mode === "full";
  const showBillingCard = mode === "full" || mode === "billing-only";

  return (
    <div className="space-y-4">
      {showConsumption && !encounterStatus && canEdit && !autoStart && (
        <Button onClick={handleStartEncounter}>Iniciar atendimento</Button>
      )}
      {autoStarting && (
        <p className="text-sm text-muted-foreground">Iniciando atendimento…</p>
      )}

      {showConsumption && encounterStatus && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{ENCOUNTER_LABEL[encounterStatus] ?? encounterStatus}</Badge>
          {comanda && (
            <Badge variant="secondary">
              Comanda {comanda.issued_at ? comanda.status : "provisória"}
              {comanda.remainder > 0 && ` · falta ${fmt(comanda.remainder)}`}
            </Badge>
          )}
        </div>
      )}

      {showConsumption && committedUnits > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Package className="h-3.5 w-3.5" />
          {committedUnits} un. de material reservadas nesta consulta
        </p>
      )}

      {showClinicalCard && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="font-semibold">Atendimento clínico</h3>
            {canFinishClinical && (
              <Button variant="default" size="sm" onClick={startClinicalFinishFlow}>
                Encerrar atendimento clínico
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {encounterStatus === "em_andamento" && (
              <p className="text-muted-foreground">
                Confirme materiais e fichas, depois encerre o atendimento clínico para baixar o
                estoque.
              </p>
            )}
            {encounterStatus === "finalizado_aguardando_cobranca" && !isComandaFinalized && (
              <p className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Atendimento encerrado — aguardando finalização da comanda.
                {stockConsumed && " Estoque consumido."}
              </p>
            )}
            {isFullyPaid && (
              <p className="text-green-700 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Cupom quitado.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {showBillingCard && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Cobrança
            </h3>
            {canEmitComanda && (
              <Button variant="default" size="sm" onClick={openEmitModal}>
                Finalizar comanda
              </Button>
            )}
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {!canEmitComanda && !isComandaFinalized && encounterStatus !== "finalizado_aguardando_cobranca" && (
              <p className="text-muted-foreground">
                Encerre o atendimento clínico antes de finalizar a comanda.
              </p>
            )}
            {comanda && (
              <div className="rounded-lg border p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{fmt(comanda.total_amount)}</span>
                </div>
                {comanda.discount_amount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Desconto</span>
                    <span>-{fmt(comanda.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pago</span>
                  <span>{fmt(comanda.paid_amount)}</span>
                </div>
                {comanda.remainder > 0 && (
                  <p className="text-amber-700 dark:text-amber-400 text-xs pt-1">
                    Saldo em contas a receber: {fmt(comanda.remainder)}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showConsumption && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-semibold">Consumo de material</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum material vinculado. Adicione insumos usados no procedimento.
              </p>
            ) : (
              <ul className="divide-y">
                {lines.map((line) => (
                  <li key={line.id} className="flex items-center justify-between py-2 gap-2">
                    <div className="min-w-0">
                      <span className="font-medium">{line.product_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({line.source})</span>
                      {line.stock_available != null && canEditConsumption && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Disponível: {line.stock_available} {line.unit ?? "un"}
                          {line.stock_committed != null && line.stock_committed > 0 && (
                            <span className="text-amber-700 dark:text-amber-400 ml-1">
                              ({line.stock_committed} comprometidas)
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canEditConsumption ? (
                        <>
                          <Input
                            type="number"
                            className="w-16 h-8"
                            value={line.quantity}
                            onChange={(e) => {
                              const q = parseFloat(e.target.value) || 0;
                              updateConsumptionQuantity(line.id, q).then(() => load());
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeConsumptionLine(line.id).then(() => load())}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <span>{line.quantity}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {canEditConsumption && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <select
                  className="h-9 rounded-md border px-2 text-sm flex-1 min-w-[140px]"
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                >
                  <option value="">Adicionar produto…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Input className="w-20 h-9" value={addQty} onChange={(e) => setAddQty(e.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}

            {isClinicalLocked && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Consumo bloqueado após encerramento clínico.
                {stockConsumed && " Estoque baixado."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={clinicalAttentionOpen} onOpenChange={setClinicalAttentionOpen}>
        <DialogContent title="Encerrar atendimento clínico" onClose={() => setClinicalAttentionOpen(false)} className="max-w-md">
          <div className="space-y-4">
            <div className="flex gap-3 text-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Após encerrar, o consumo de material será bloqueado e o estoque será baixado.
                Confirme os materiais utilizados antes de continuar.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setClinicalAttentionOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmClinicalAttention}>Revisar materiais</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={materialsOpen} onOpenChange={setMaterialsOpen}>
        <DialogContent
          title="Revisar materiais utilizados"
          onClose={() => setMaterialsOpen(false)}
          className="max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Revise as quantidades antes de encerrar o atendimento clínico.
            </p>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum material na lista.</p>
            ) : (
              <ul className="divide-y text-sm max-h-60 overflow-y-auto">
                {lines.map((line) => (
                  <li key={line.id} className="flex justify-between py-2 gap-2">
                    <div>
                      <span className="font-medium">{line.product_name}</span>
                      <p className="text-xs text-muted-foreground">
                        Disponível: {line.stock_available ?? "—"} {line.unit ?? "un"}
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="w-20 h-8"
                      value={line.quantity}
                      disabled={!canEditConsumption}
                      onChange={(e) => {
                        const q = parseFloat(e.target.value) || 0;
                        updateConsumptionQuantity(line.id, q).then(() => load());
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
            {canEditConsumption && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <select
                  className="h-9 rounded-md border px-2 text-sm flex-1 min-w-[140px]"
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                >
                  <option value="">Adicionar produto extra…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Input className="w-20 h-9" value={addQty} onChange={(e) => setAddQty(e.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Button className="w-full" onClick={handleFinishClinical} disabled={finishingClinical}>
              {finishingClinical ? "Encerrando…" : "Encerrar atendimento clínico"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={emitOpen} onOpenChange={setEmitOpen}>
        <DialogContent title="Finalizar comanda" onClose={() => setEmitOpen(false)} className="max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="space-y-4">
            {loadingBilling ? (
              <p className="text-sm text-muted-foreground">Calculando totais…</p>
            ) : billingPreview ? (
              <div className="rounded-lg border p-3 space-y-2 text-sm">
                {billingPreview.serviceName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serviço — {billingPreview.serviceName}</span>
                    <span>{fmt(billingPreview.serviceAmount)}</span>
                  </div>
                )}
                {chargeMaterials &&
                  billingPreview.materialLines.map((l, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        {l.name} × {l.quantity}
                      </span>
                      <span>{fmt(l.line_total)}</span>
                    </div>
                  ))}
                {!chargeMaterials && billingPreview.materialsAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Insumos ({fmt(billingPreview.materialsAmount)}) não serão cobrados — já
                    inclusos no serviço ou apenas rastreados no estoque.
                  </p>
                )}
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{fmt(billingPreview.subtotalAmount)}</span>
                </div>
                {billingPreview.discountAmount > 0 && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-400">
                    <span>Desconto</span>
                    <span>-{fmt(billingPreview.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total da comanda</span>
                  <span>{fmt(billingPreview.totalAmount)}</span>
                </div>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={chargeMaterials}
                onChange={(e) => handleChargeMaterialsChange(e.target.checked)}
                className="rounded border"
              />
              Cobrar insumos separadamente
            </label>

            <div className="space-y-2">
              <Label>Desconto no total</Label>
              <div className="flex gap-2">
                <select
                  className="h-9 rounded-md border px-2 text-sm"
                  value={discountMode}
                  onChange={(e) =>
                    handleDiscountChange(e.target.value as "none" | "amount" | "percent", discountValue)
                  }
                >
                  <option value="none">Sem desconto</option>
                  <option value="amount">Valor (R$)</option>
                  <option value="percent">Percentual (%)</option>
                </select>
                {discountMode !== "none" && (
                  <Input
                    className="h-9 flex-1"
                    value={discountValue}
                    onChange={(e) => handleDiscountChange(discountMode, e.target.value)}
                    placeholder={discountMode === "percent" ? "10" : "50,00"}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>

            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-muted/50"
                onClick={() => setPaymentExpanded((v) => !v)}
              >
                Receber pagamento agora {paymentExpanded ? "▾" : "▸"}
              </button>
              {paymentExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t">
                  <div className="space-y-1 pt-2">
                    <Label>Valor (R$)</Label>
                    <Input
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0 — deixe vazio para emitir sem receber"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Forma de pagamento</Label>
                    <select
                      className="h-9 w-full rounded-md border px-3 text-sm"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao">Cartão</option>
                      <option value="transferencia">Transferência</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => handleEmit(0)}
                disabled={emitting}
                variant="outline"
              >
                {emitting ? "Finalizando…" : "Finalizar comanda"}
              </Button>
              {paymentExpanded && (
                <Button
                  className="w-full"
                  onClick={() => handleEmit()}
                  disabled={emitting}
                >
                  {emitting ? "Processando…" : "Emitir e receber"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent title="Cupom emitido" onClose={() => setSummaryOpen(false)} className="max-w-md">
          {savedComanda && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <Badge variant="outline">{savedComanda.status}</Badge>
              </div>
              <ul className="divide-y text-sm">
                {savedComanda.items.map((item) => (
                  <li key={item.id} className="flex justify-between py-2">
                    <span>
                      {item.description} × {item.quantity}
                    </span>
                    <span>{fmt(item.total_price)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total</span>
                <span>{fmt(savedComanda.total_amount)}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Pago: {fmt(savedComanda.paid_amount)}
                {savedComanda.remainder > 0 && (
                  <span className="text-amber-700 dark:text-amber-400 ml-1">
                    (saldo {fmt(savedComanda.remainder)} em contas a receber)
                  </span>
                )}
              </p>
              <Button className="w-full" onClick={() => setSummaryOpen(false)}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
