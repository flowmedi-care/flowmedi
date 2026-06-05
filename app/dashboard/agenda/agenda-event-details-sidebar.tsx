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

type SidebarVariant = "inline" | "overlay";

export function AgendaEventDetailsSidebar({
  appointmentId,
  open,
  onClose,
  onEdit,
  onFinalize,
  variant = "overlay",
}: {
  appointmentId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
  onFinalize?: (id: string) => void;
  variant?: SidebarVariant;
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

  const panel = (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="text-base font-semibold">Detalhes do evento</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {data && !loading && (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
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
                  <Stethoscope className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{data.doctor.full_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{data.patient.full_name}</span>
              </div>
              {data.patient.phone && (
                <p className="pl-6 text-muted-foreground">{formatPhoneBr(data.patient.phone)}</p>
              )}
            </div>

            {data.procedures.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Procedimentos
                </p>
                <ul className="text-sm space-y-0.5">
                  {data.procedures.map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border p-3 space-y-2 text-sm bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                Comanda{isProvisional ? " (provisória)" : isFinalized ? "" : ""}
              </p>
              {data.service_name && !displayItems.some((i) => i.label.includes(data.service_name!)) && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">{data.service_name}</span>
                  <span className="shrink-0">{fmt(data.charge.serviceAmount)}</span>
                </div>
              )}
              {displayItems.map((item, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">
                    {item.label}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </span>
                  <span className="shrink-0">{fmt(item.total)}</span>
                </div>
              ))}
              {displayItems.length === 0 && !data.service_name && (
                <p className="text-muted-foreground text-xs">Sem itens na comanda.</p>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total</span>
                <span>{fmt(totalDisplay)}</span>
              </div>
              {data.comanda && isFinalized && (
                <p className="text-xs text-muted-foreground pt-1">
                  Pago: {fmt(data.comanda.paid_amount)} / {fmt(data.comanda.total_amount)}
                  {data.comanda.remainder > 0 && (
                    <span className="text-amber-700 dark:text-amber-400 ml-1">
                      (falta {fmt(data.comanda.remainder)})
                    </span>
                  )}
                </p>
              )}
            </div>

            {data.stockCommittedUnits > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                {data.stockCommittedUnits} un. de material reservadas
              </p>
            )}

            <div className="space-y-1">
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-primary hover:underline w-full text-left py-1"
                onClick={() => onEdit(data.id)}
              >
                <Pencil className="h-4 w-4" />
                Editar agendamento
              </button>
            </div>

            <div className="space-y-2 pt-2">
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
                <p className="text-xs text-muted-foreground flex items-center gap-1 px-1">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Formulários vinculados — nenhum pendente
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {data && !loading && (
        <div className="shrink-0 border-t p-4 space-y-2">
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/dashboard/agenda/atendimento/${data.id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Visualizar atendimento
            </Link>
          </Button>
          <Button
            className="w-full"
            disabled={!data.comanda || isFinalized}
            onClick={() => onFinalize?.(data.id)}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {isFinalized ? "Comanda finalizada" : "Finalizar comanda"}
          </Button>
        </div>
      )}

      <Dialog open={materialsOpen} onOpenChange={setMaterialsOpen}>
        <DialogContent
          title="Editar consumo de material"
          onClose={() => setMaterialsOpen(false)}
          className="max-w-lg"
        >
          {loadingConsumption ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>
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
                <ul className="divide-y text-sm max-h-60 overflow-y-auto">
                  {consumptionLines.map((line) => (
                    <li key={line.id} className="flex justify-between items-center py-2 gap-2">
                      <div className="min-w-0">
                        <span className="font-medium">{line.product_name}</span>
                        <p className="text-xs text-muted-foreground">
                          Disp.: {line.stock_available ?? "—"} {line.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          className="w-20 h-8"
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
                  <Input
                    className="w-20 h-9"
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
    </div>
  );

  if (variant === "inline") {
    return (
      <aside className="w-full h-full min-h-0 flex flex-col border-l border-border">
        {panel}
      </aside>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 ml-auto w-full max-w-md flex flex-col h-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {panel}
      </div>
    </div>
  );
}
