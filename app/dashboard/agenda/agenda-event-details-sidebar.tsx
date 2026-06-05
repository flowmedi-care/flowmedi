"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getAppointmentEventSummary, type AppointmentEventSummary } from "./actions";
import {
  getAppointmentConsumption,
  addConsumptionLine,
  updateConsumptionQuantity,
  removeConsumptionLine,
  type ConsumptionLine,
} from "./encounter-actions";
import { sendPreAppointmentForms } from "./consulta/[id]/formularios-consulta-actions";
import { listProductsForClinic } from "@/app/dashboard/campos-pacientes/actions";
import { formatPhoneBr } from "@/lib/format-phone";
import { toast } from "@/components/ui/toast";
import {
  User,
  Stethoscope,
  Pencil,
  ExternalLink,
  Package,
  CreditCard,
  Loader2,
  X,
  ClipboardList,
  Send,
  Trash2,
  Plus,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AgendaEventDetailsSidebar({
  appointmentId,
  open,
  onClose,
  onEdit,
  onFinalize,
}: {
  appointmentId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
  onFinalize?: (id: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AppointmentEventSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [consumptionLines, setConsumptionLines] = useState<ConsumptionLine[]>([]);
  const [consumptionLocked, setConsumptionLocked] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [loadingConsumption, setLoadingConsumption] = useState(false);
  const [sendingForms, setSendingForms] = useState(false);

  const loadSummary = useCallback(() => {
    if (!appointmentId) return;
    setLoading(true);
    setError(null);
    getAppointmentEventSummary(appointmentId).then((res) => {
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error ?? "Não foi possível carregar.");
        setData(null);
      } else {
        setData(res.data);
      }
    });
  }, [appointmentId]);

  useEffect(() => {
    if (!open || !appointmentId) {
      setData(null);
      return;
    }
    loadSummary();
  }, [open, appointmentId, loadSummary]);

  useEffect(() => {
    if (!open) {
      setMaterialsOpen(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function loadConsumption() {
    if (!appointmentId) return;
    setLoadingConsumption(true);
    const res = await getAppointmentConsumption(appointmentId);
    setLoadingConsumption(false);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    setConsumptionLines(res.data);
    const status = res.encounter?.status ?? null;
    setConsumptionLocked(
      status === "finalizado_aguardando_cobranca" || status === "cobrado"
    );
    const prods = await listProductsForClinic();
    if (!prods.error) setProducts(prods.data);
  }

  async function openMaterialsDialog() {
    setMaterialsOpen(true);
    await loadConsumption();
  }

  async function handleAddLine() {
    if (!appointmentId || !addProductId) return;
    const res = await addConsumptionLine(appointmentId, addProductId, parseFloat(addQty) || 1);
    if (res.error) toast(res.error, "error");
    else {
      setAddProductId("");
      await loadConsumption();
      loadSummary();
      router.refresh();
    }
  }

  async function handleUpdateQty(lineId: string, qty: number) {
    const res = await updateConsumptionQuantity(lineId, qty);
    if (res.error) toast(res.error, "error");
    else {
      await loadConsumption();
      loadSummary();
      router.refresh();
    }
  }

  async function handleRemoveLine(lineId: string) {
    const res = await removeConsumptionLine(lineId);
    if (res.error) toast(res.error, "error");
    else {
      await loadConsumption();
      loadSummary();
      router.refresh();
    }
  }

  async function handleSendForms() {
    if (!appointmentId) return;
    setSendingForms(true);
    const res = await sendPreAppointmentForms(appointmentId);
    setSendingForms(false);
    if (res.error) toast(res.error, "error");
    else if (res.sent === 0) toast("Nenhum formulário pendente para enviar.", "info");
    else toast(`${res.sent} formulário(s) enviado(s).`, "success");
  }

  if (!open || !appointmentId) return null;

  const isProvisional = data?.comanda_issued_at == null && !!data?.comanda;
  const isFinalized = !!data?.comanda_issued_at;
  const pendingForms = data?.forms.filter((f) => f.status === "pendente") ?? [];
  const displayItems =
    data?.comanda_items.length
      ? data.comanda_items.map((i) => ({
          label: i.description,
          quantity: i.quantity,
          total: i.total_price,
        }))
      : data?.charge.materialLines.map((l) => ({
          label: l.product_name,
          quantity: l.quantity,
          total: l.line_total,
        })) ?? [];

  const totalDisplay =
    data?.comanda?.total_amount ??
    data?.charge.totalAmount ??
    data?.valor ??
    0;

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <div
          className="absolute inset-0 bg-black/30"
          onClick={onClose}
          aria-hidden
        />
        <aside
          className="relative z-10 flex h-dvh w-full max-w-[400px] flex-col bg-background border-l border-border shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">Detalhes do evento</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando…
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {data && !loading && (
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Agendamento
                  </p>
                  <p className="font-medium capitalize">
                    {new Date(data.scheduled_at).toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                    {" · "}
                    {new Date(data.scheduled_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <Badge variant="outline" className="mt-2">
                    {STATUS_LABEL[data.status] ?? data.status}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  {data.doctor?.full_name && (
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{data.doctor.full_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{data.patient.full_name}</span>
                  </div>
                  {data.patient.phone && (
                    <p className="pl-6 text-muted-foreground">{formatPhoneBr(data.patient.phone)}</p>
                  )}
                </div>

                {data.procedures.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Procedimentos
                    </p>
                    <ul className="space-y-0.5 text-sm">
                      {data.procedures.map((p) => (
                        <li key={p.id}>{p.name}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    Comanda{isProvisional ? " (provisória)" : ""}
                  </p>
                  {data.service_name &&
                    !displayItems.some((i) => i.label.includes(data.service_name!)) && (
                      <div className="flex justify-between gap-2">
                        <span className="truncate text-muted-foreground">{data.service_name}</span>
                        <span className="shrink-0">{fmt(data.charge.serviceAmount)}</span>
                      </div>
                    )}
                  {displayItems.map((item, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="truncate text-muted-foreground">
                        {item.label}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      </span>
                      <span className="shrink-0">{fmt(item.total)}</span>
                    </div>
                  ))}
                  {displayItems.length === 0 && !data.service_name && (
                    <p className="text-xs text-muted-foreground">Sem itens na comanda.</p>
                  )}
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total</span>
                    <span>{fmt(totalDisplay)}</span>
                  </div>
                  {data.comanda && isFinalized && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      Pago: {fmt(data.comanda.paid_amount)} / {fmt(data.comanda.total_amount)}
                      {data.comanda.remainder > 0 && (
                        <span className="ml-1 text-amber-700 dark:text-amber-400">
                          (falta {fmt(data.comanda.remainder)})
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {data.stockCommittedUnits > 0 && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    {data.stockCommittedUnits} un. de material reservadas
                  </p>
                )}

                <button
                  type="button"
                  className="flex w-full items-center gap-2 py-1 text-left text-sm text-primary hover:underline"
                  onClick={() => onEdit(data.id)}
                >
                  <Pencil className="h-4 w-4" />
                  Editar agendamento
                </button>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={openMaterialsDialog}
                  >
                    <Package className="h-4 w-4" />
                    Editar consumo de material
                  </Button>
                  {pendingForms.length > 0 && (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={handleSendForms}
                      disabled={sendingForms}
                    >
                      {sendingForms ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar formulário de pré-atendimento
                      <Badge variant="secondary" className="ml-auto">
                        {pendingForms.length}
                      </Badge>
                    </Button>
                  )}
                  {data.forms.length > 0 && pendingForms.length === 0 && (
                    <p className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Formulários vinculados — nenhum pendente
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-2 border-t bg-background p-4">
            {data && !loading ? (
              <>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/dashboard/agenda/atendimento/${data.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Visualizar atendimento
                  </Link>
                </Button>
                <Button
                  className="w-full"
                  disabled={!data.comanda || isFinalized}
                  onClick={() => onFinalize?.(data.id)}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {isFinalized ? "Comanda finalizada" : "Finalizar comanda"}
                </Button>
              </>
            ) : (
              <div className="h-[88px]" aria-hidden />
            )}
          </div>
        </aside>
      </div>

      <Dialog open={materialsOpen} onOpenChange={setMaterialsOpen}>
        <DialogContent
          title="Editar consumo de material"
          onClose={() => setMaterialsOpen(false)}
          className="max-w-lg"
        >
          {loadingConsumption ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="space-y-4">
              {consumptionLocked && (
                <p className="text-sm text-muted-foreground">
                  Consumo bloqueado após encerramento clínico.
                </p>
              )}
              {consumptionLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum material na lista.</p>
              ) : (
                <ul className="max-h-60 divide-y overflow-y-auto text-sm">
                  {consumptionLines.map((line) => (
                    <li key={line.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <span className="font-medium">{line.product_name}</span>
                        <p className="text-xs text-muted-foreground">
                          Disp.: {line.stock_available ?? "—"} {line.unit}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Input
                          type="number"
                          className="h-8 w-20"
                          value={line.quantity}
                          disabled={consumptionLocked}
                          onChange={(e) => {
                            const q = parseFloat(e.target.value) || 0;
                            handleUpdateQty(line.id, q);
                          }}
                        />
                        {!consumptionLocked && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveLine(line.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!consumptionLocked && (
                <div className="flex flex-wrap gap-2 border-t pt-2">
                  <select
                    className="h-9 min-w-[140px] flex-1 rounded-md border px-2 text-sm"
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
                  <Input
                    className="h-9 w-20"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
