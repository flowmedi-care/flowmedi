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
  finalizeBilling,
  getBillingPreview,
  startEncounter,
  type ConsumptionLine,
  type BillingPreview,
  type ComandaDetail,
} from "../../encounter-actions";
import { listProductsForClinic } from "@/app/dashboard/campos-pacientes/actions";
import { toast } from "@/components/ui/toast";
import { Trash2, Plus, Package, AlertTriangle, CheckCircle2 } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AtendimentoClient({
  appointmentId,
  appointmentValor,
  canEdit,
  autoFinalize = false,
}: {
  appointmentId: string;
  appointmentValor: number | null;
  canEdit: boolean;
  autoFinalize?: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<ConsumptionLine[]>([]);
  const [encounterStatus, setEncounterStatus] = useState<string | null>(null);
  const [stockConsumed, setStockConsumed] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [consumeStock, setConsumeStock] = useState(true);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [billingPreview, setBillingPreview] = useState<BillingPreview | null>(null);
  const [savedComanda, setSavedComanda] = useState<ComandaDetail | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("1");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getAppointmentConsumption(appointmentId);
    if (!res.error) {
      setLines(res.data);
      setEncounterStatus(res.encounter?.status ?? null);
      setStockConsumed(!!res.encounter?.stock_consumed_at);
    }
    const prods = await listProductsForClinic();
    if (!prods.error) setProducts(prods.data);
    setLoading(false);
  }, [appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (autoFinalize && !loading && canEdit && encounterStatus !== "cobrado") {
      setAttentionOpen(true);
    }
  }, [autoFinalize, loading, canEdit, encounterStatus]);

  const isLocked = encounterStatus === "cobrado";
  const committedUnits = lines.reduce((s, l) => s + l.quantity, 0);

  async function handleStartEncounter() {
    const res = await startEncounter(appointmentId);
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

  function startFinalizeFlow() {
    setConsumeStock(true);
    setAttentionOpen(true);
  }

  function confirmAttention() {
    setAttentionOpen(false);
    if (consumeStock) {
      setMaterialsOpen(true);
    } else {
      openBillingModal();
    }
  }

  async function openBillingModal() {
    setMaterialsOpen(false);
    setBillingOpen(true);
    setLoadingBilling(true);
    const res = await getBillingPreview(appointmentId);
    setLoadingBilling(false);
    if (res.error) {
      toast(res.error, "error");
      setBillingOpen(false);
      return;
    }
    if (res.data) {
      setBillingPreview(res.data);
      setPaymentAmount(String(res.data.totalAmount));
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    const amount = parseFloat(paymentAmount.replace(",", ".")) || 0;
    const res = await finalizeBilling(appointmentId, amount, paymentMethod, {
      consumeStock,
    });
    setFinalizing(false);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("Comanda criada e cobrança registrada.", "success");
    setBillingOpen(false);
    if (res.comanda) {
      setSavedComanda(res.comanda);
      setSummaryOpen(true);
    }
    router.refresh();
    load();
  }

  return (
    <div className="space-y-4">
      {!encounterStatus && canEdit && (
        <Button onClick={handleStartEncounter}>Iniciar atendimento</Button>
      )}

      {committedUnits > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Package className="h-3.5 w-3.5" />
          {committedUnits} un. de material reservadas nesta consulta
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h3 className="font-semibold">Consumo de material</h3>
          {canEdit && !isLocked && (
            <Button variant="outline" size="sm" onClick={startFinalizeFlow}>
              Finalizar comanda
            </Button>
          )}
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
                    {line.stock_available != null && !isLocked && (
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
                    {canEdit && !isLocked ? (
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

          {canEdit && !isLocked && (
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

          {isLocked && (
            <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Cobrança finalizada — consumo bloqueado.
              {stockConsumed && " Estoque baixado."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Atenção antes de finalizar */}
      <Dialog open={attentionOpen} onOpenChange={setAttentionOpen}>
        <DialogContent title="Atenção" onClose={() => setAttentionOpen(false)} className="max-w-md">
          <div className="space-y-4">
            <div className="flex gap-3 text-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Após finalizar a comanda, o consumo de material será bloqueado para edição. Confirme
                os materiais utilizados antes de continuar.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={consumeStock}
                onChange={(e) => setConsumeStock(e.target.checked)}
                className="rounded border"
              />
              Lançar consumo de material no estoque
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAttentionOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmAttention}>Continuar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Materiais utilizados */}
      <Dialog open={materialsOpen} onOpenChange={setMaterialsOpen}>
        <DialogContent
          title="Cadastrar materiais utilizados"
          onClose={() => setMaterialsOpen(false)}
          className="max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Revise as quantidades. Produtos extras podem ser adicionados abaixo.
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
                      disabled={isLocked}
                      onChange={(e) => {
                        const q = parseFloat(e.target.value) || 0;
                        updateConsumptionQuantity(line.id, q).then(() => load());
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
            {!isLocked && (
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
            <Button className="w-full" onClick={openBillingModal}>
              Lançar consumo e continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cobrança */}
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent title="Resumo e cobrança" onClose={() => setBillingOpen(false)}>
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
                {billingPreview.materialLines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      {l.name} × {l.quantity}
                    </span>
                    <span>{fmt(l.line_total)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total da comanda</span>
                  <span>{fmt(billingPreview.totalAmount)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Revise os materiais e confirme o pagamento.</p>
            )}
            {consumeStock && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                O estoque será baixado ao salvar.
              </p>
            )}
            <div className="space-y-2">
              <Label>Valor pago agora (R$)</Label>
              <Input
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={
                  billingPreview
                    ? String(billingPreview.totalAmount)
                    : appointmentValor != null
                      ? String(appointmentValor)
                      : "0"
                }
              />
            </div>
            <div className="space-y-2">
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
            <Button className="w-full" onClick={handleFinalize} disabled={finalizing}>
              {finalizing ? "Salvando…" : "Salvar comanda e registrar pagamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resumo pós-finalização */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent title="Comanda finalizada" onClose={() => setSummaryOpen(false)} className="max-w-md">
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
                    (falta {fmt(savedComanda.remainder)})
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
