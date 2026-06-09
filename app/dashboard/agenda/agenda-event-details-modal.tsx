"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAppointmentEventSummary, type AppointmentEventSummary } from "./actions";
import { formatPhoneBr } from "@/lib/format-phone";
import {
  CalendarClock,
  User,
  Stethoscope,
  Pencil,
  ExternalLink,
  Package,
  CreditCard,
  Loader2,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AgendaEventDetailsModal({
  appointmentId,
  open,
  onOpenChange,
  onEdit,
  onFinalize,
}: {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (id: string) => void;
  onFinalize?: (id: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AppointmentEventSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !appointmentId) {
      setData(null);
      return;
    }
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
  }, [open, appointmentId]);

  const isBilled = data?.encounterStatus === "cobrado";
  const isComandaFinalized = !!data?.comanda_issued_at;
  const canEmitComanda = !!data?.comanda && !isComandaFinalized;

  const hasComanda = !!data?.comanda;
  const displayItems = hasComanda
    ? (data?.comanda_items ?? []).map((i) => ({
        label: i.description,
        quantity: i.quantity,
        total: i.total_price,
      }))
    : [
        ...(data?.service_name
          ? [
              {
                label: `Serviço — ${data.service_name}`,
                quantity: 1,
                total: data?.charge.serviceAmount ?? 0,
              },
            ]
          : []),
        ...(data?.charge.materialLines.map((l) => ({
          label: l.product_name,
          quantity: l.quantity,
          total: l.line_total,
        })) ?? []),
      ];
  const totalDisplay = hasComanda
    ? (data?.comanda?.total_amount ?? 0)
    : (data?.charge.totalAmount ?? 0);
  const subtotalDisplay = hasComanda ? (data?.comanda?.subtotal_amount ?? totalDisplay) : null;
  const discountDisplay = hasComanda ? (data?.comanda?.discount_amount ?? 0) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Detalhes do evento"
        onClose={() => onOpenChange(false)}
        className="max-w-lg"
      >
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {data && !loading && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium capitalize">
                  {new Date(data.scheduled_at).toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                  {" · "}
                  {new Date(data.scheduled_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <Badge variant="outline" className="mt-1">
                  {STATUS_LABEL[data.status] ?? data.status}
                </Badge>
              </div>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{data.patient.full_name}</span>
                {data.patient.phone && (
                  <span className="text-muted-foreground">{formatPhoneBr(data.patient.phone)}</span>
                )}
              </div>
              {data.doctor?.full_name && (
                <p className="text-muted-foreground pl-6">Profissional: {data.doctor.full_name}</p>
              )}
            </div>

            {data.procedures.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5" />
                  Procedimentos
                </p>
                <ul className="space-y-1">
                  {data.procedures.map((p) => (
                    <li key={p.id} className="flex justify-between text-sm">
                      <span>{p.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                Comanda{hasComanda && !isComandaFinalized ? " (provisória)" : ""}
              </p>
              {displayItems.map((item, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">
                    {item.label}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </span>
                  <span className="shrink-0">{fmt(item.total)}</span>
                </div>
              ))}
              {discountDisplay > 0 && subtotalDisplay != null && (
                <>
                  <div className="flex justify-between gap-2 pt-1">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{fmt(subtotalDisplay)}</span>
                  </div>
                  <div className="flex justify-between gap-2 text-amber-700 dark:text-amber-400">
                    <span>Desconto</span>
                    <span>-{fmt(discountDisplay)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total</span>
                <span>{fmt(totalDisplay)}</span>
              </div>
            </div>

            {data.stockCommittedUnits > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                {data.stockCommittedUnits} un. de material reservadas nesta consulta
              </p>
            )}

            {data.encounterStatus && (
              <p className="text-xs text-muted-foreground">
                Atendimento:{" "}
                {data.encounterStatus === "finalizado_aguardando_cobranca"
                  ? "Aguardando comanda"
                  : data.encounterStatus === "em_andamento"
                    ? "Em andamento"
                    : data.encounterStatus === "cobrado"
                      ? "Quitado"
                      : data.encounterStatus}
              </p>
            )}

            {data.comanda && isComandaFinalized && (
              <div className="rounded-md border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-3 text-sm space-y-1">
                <p className="font-medium flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  Comanda — {data.comanda.status}
                </p>
                <p>
                  Pago: {fmt(data.comanda.paid_amount)} / {fmt(data.comanda.total_amount)}
                  {data.comanda.remainder > 0 && (
                    <span className="text-amber-700 dark:text-amber-400 ml-1">
                      (falta {fmt(data.comanda.remainder)})
                    </span>
                  )}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => onEdit(data.id)}>
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/agenda/consulta/${data.id}`}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Consulta
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/agenda/atendimento/${data.id}`}>
                  <Package className="h-4 w-4 mr-1" />
                  Atendimento
                </Link>
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {canEmitComanda && onFinalize && (
                <Button
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    onFinalize(data.id);
                  }}
                >
                  Finalizar comanda
                </Button>
              )}
              {!isBilled && (
                <Button variant="secondary" className="w-full" asChild>
                  <Link href={`/dashboard/agenda/atendimento/${data.id}`}>
                    Gerenciar atendimento
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
