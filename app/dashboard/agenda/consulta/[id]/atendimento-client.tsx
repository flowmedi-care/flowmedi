"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
} from "../../encounter-actions";
import { listProductsForClinic } from "@/app/dashboard/campos-pacientes/actions";
import { toast } from "@/components/ui/toast";
import { Pencil, Trash2, Plus } from "lucide-react";

export function AtendimentoClient({
  appointmentId,
  appointmentValor,
  canEdit,
}: {
  appointmentId: string;
  appointmentValor: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<ConsumptionLine[]>([]);
  const [encounterStatus, setEncounterStatus] = useState<string | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingPreview, setBillingPreview] = useState<BillingPreview | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("1");

  async function load() {
    setLoading(true);
    const res = await getAppointmentConsumption(appointmentId);
    if (!res.error) {
      setLines(res.data);
      setEncounterStatus(res.encounter?.status ?? null);
    }
    const prods = await listProductsForClinic();
    if (!prods.error) setProducts(prods.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [appointmentId]);

  const isLocked = encounterStatus === "cobrado";

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

  async function openBilling() {
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
    const amount = parseFloat(paymentAmount.replace(",", ".")) || 0;
    const res = await finalizeBilling(appointmentId, amount, paymentMethod);
    if (res.error) toast(res.error, "error");
    else {
      toast("Comanda criada e cobrança registrada.", "success");
      setBillingOpen(false);
      router.refresh();
      load();
    }
  }

  return (
    <div className="space-y-4">
      {!encounterStatus && canEdit && (
        <Button onClick={handleStartEncounter}>Iniciar atendimento</Button>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h3 className="font-semibold">Consumo de material</h3>
          {canEdit && !isLocked && (
            <Button variant="outline" size="sm" onClick={openBilling}>
              Finalizar cobrança
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum material vinculado. Adicione insumos usados no procedimento.</p>
          ) : (
            <ul className="divide-y">
              {lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between py-2 gap-2">
                  <div>
                    <span className="font-medium">{line.product_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({line.source})</span>
                  </div>
                  <div className="flex items-center gap-2">
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
                        <Button variant="ghost" size="icon" onClick={() => removeConsumptionLine(line.id).then(() => load())}>
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
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Input className="w-20 h-9" value={addQty} onChange={(e) => setAddQty(e.target.value)} />
              <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {isLocked && (
            <p className="text-sm text-green-700 dark:text-green-400">Cobrança finalizada — consumo bloqueado.</p>
          )}
        </CardContent>
      </Card>

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
                    <span>
                      {billingPreview.serviceAmount.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                )}
                {billingPreview.materialLines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      {l.name} × {l.quantity}
                    </span>
                    <span>
                      {l.line_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total da comanda</span>
                  <span>
                    {billingPreview.totalAmount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Revise os materiais e confirme o pagamento.
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
            <Button className="w-full" onClick={handleFinalize}>
              Salvar comanda e registrar pagamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
