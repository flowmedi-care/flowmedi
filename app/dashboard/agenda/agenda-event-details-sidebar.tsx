"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { formatAppointmentTimeRange } from "@/lib/appointment-scheduling";
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
  ArrowLeft,
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
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => setMounted(true), []);

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

  async function openMaterialsPanel() {
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

  if (!mounted || !open || !appointmentId) return null;

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

  return createPortal(
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <aside
        className="relative z-10 flex h-svh max-h-svh w-full max-w-[380px] flex-col bg-background border-l border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {materialsOpen ? (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setMaterialsOpen(false)}
                aria-label="Voltar"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                Consumo de material
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onClose}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {loadingConsumption ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <div className="space-y-3">
                  {consumptionLocked && (
                    <p className="text-xs text-muted-foreground">
                      Consumo bloqueado após encerramento clínico.
                    </p>
                  )}
                  {consumptionLines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum material na lista.</p>
                  ) : (
                    <ul className="divide-y text-sm">
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
                              className="h-8 w-16"
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
                    <div className="flex gap-2 border-t pt-3">
                      <select
                        className="h-8 min-w-0 flex-1 rounded-md border px-2 text-xs"
                        value={addProductId}
                        onChange={(e) => setAddProductId(e.target.value)}
                      >
                        <option value="">Adicionar…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        className="h-8 w-14"
                        value={addQty}
                        onChange={(e) => setAddQty(e.target.value)}
                      />
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleAddLine}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b px-3 py-2.5">
              <h2 className="text-sm font-semibold">Detalhes do evento</h2>
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

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando…
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}

              {data && !loading && (
                <div className="space-y-3">
                  <div>
                    <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Horário
                    </p>
                    <p className="text-sm font-medium capitalize leading-snug">
                      {new Date(data.scheduled_at).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-sm">
                      {formatAppointmentTimeRange(
                        data.scheduled_at,
                        data.scheduled_end_at ?? data.scheduled_at
                      )}
                      {data.planned_duration_minutes != null && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {data.planned_duration_minutes} min previstos
                        </span>
                      )}
                    </p>
                    {data.room_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sala: {data.room_name}
                      </p>
                    )}
                    <Badge variant="outline" className="mt-1.5 h-5 text-[10px]">
                      {STATUS_LABEL[data.status] ?? data.status}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm">
                    {data.doctor?.full_name && (
                      <div className="flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{data.doctor.full_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{data.patient.full_name}</span>
                    </div>
                    {data.patient.phone && (
                      <p className="pl-5 text-xs text-muted-foreground">
                        {formatPhoneBr(data.patient.phone)}
                      </p>
                    )}
                  </div>

                  {data.procedures.length > 0 && (
                    <div>
                      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Procedimentos
                      </p>
                      <p className="text-sm">{data.procedures.map((p) => p.name).join(", ")}</p>
                    </div>
                  )}

                  <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5 text-sm">
                    <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <CreditCard className="h-3 w-3" />
                      Comanda{isProvisional ? " (provisória)" : ""}
                    </p>
                    {data.service_name &&
                      !displayItems.some((i) => i.label.includes(data.service_name!)) && (
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="truncate text-muted-foreground">{data.service_name}</span>
                          <span className="shrink-0">{fmt(data.charge.serviceAmount)}</span>
                        </div>
                      )}
                    {displayItems.map((item, i) => (
                      <div key={i} className="flex justify-between gap-2 text-xs">
                        <span className="truncate text-muted-foreground">
                          {item.label}
                          {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                        </span>
                        <span className="shrink-0">{fmt(item.total)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-1.5 text-sm font-semibold">
                      <span>Total</span>
                      <span>{fmt(totalDisplay)}</span>
                    </div>
                  </div>

                  {data.stockCommittedUnits > 0 && (
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Package className="h-3 w-3" />
                      {data.stockCommittedUnits} un. reservadas
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      onClick={() => onEdit(data.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar agendamento
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 justify-start gap-1.5 px-2 text-xs"
                      onClick={openMaterialsPanel}
                    >
                      <Package className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Materiais</span>
                    </Button>
                    {pendingForms.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 justify-start gap-1.5 px-2 text-xs"
                        onClick={handleSendForms}
                        disabled={sendingForms}
                      >
                        {sendingForms ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="truncate">Formulário</span>
                        <Badge variant="secondary" className="ml-auto h-4 min-w-4 px-1 text-[10px]">
                          {pendingForms.length}
                        </Badge>
                      </Button>
                    ) : data.forms.length > 0 ? (
                      <p className="col-span-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <ClipboardList className="h-3 w-3" />
                        Formulários ok
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t bg-background px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,12px))]">
              {data && !loading ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-9 text-xs" asChild>
                    <Link href={`/dashboard/agenda/atendimento/${data.id}`}>
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Atendimento
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 text-xs"
                    disabled={!data.comanda || isFinalized}
                    onClick={() => onFinalize?.(data.id)}
                  >
                    <CreditCard className="mr-1 h-3.5 w-3.5" />
                    {isFinalized ? "Finalizada" : "Finalizar"}
                  </Button>
                </div>
              ) : (
                <div className="h-9" aria-hidden />
              )}
            </div>
          </>
        )}
      </aside>
    </div>,
    document.body
  );
}
