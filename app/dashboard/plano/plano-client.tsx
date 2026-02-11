"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";

type PlanInfo = {
  planName: string;
  planSlug: string;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  proStripePriceId: string | null;
};

type InvoiceItem = {
  id: string;
  number?: string;
  created: number;
  amount_paid: number;
  currency: string;
  status: string;
  hosted_invoice_url?: string;
  period_start: number;
  period_end: number;
};

type SubscriptionInfo = {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  status: string | null;
};

export function PlanoClient({ plan }: { plan: PlanInfo | null }) {
  const router = useRouter();
  const checkoutRef = useRef<HTMLDivElement>(null);
  const embeddedCheckoutRef = useRef<{ destroy: () => void } | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutMounted, setCheckoutMounted] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const isPro = plan?.planSlug === "pro" && plan?.subscriptionStatus === "active";
  const isProPastDue = plan?.planSlug === "pro" && plan?.subscriptionStatus === "past_due";
  const isCanceled = plan?.subscriptionStatus === "canceled";
  const isCancelScheduled = Boolean(subscriptionInfo?.cancelAtPeriodEnd);

  useEffect(() => {
    fetch("/api/stripe/invoices")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.invoices)) setInvoices(data.invoices);
      })
      .finally(() => setLoadingInvoices(false));
  }, []);

  const loadSubscriptionInfo = async () => {
    if (!plan?.stripeSubscriptionId) {
      setSubscriptionInfo(null);
      return;
    }
    try {
      const res = await fetch("/api/stripe/subscription");
      const data = await res.json();
      console.log("subscription fetch:", { ok: res.ok, status: res.status, data });
      if (res.ok) {
        setSubscriptionInfo({
          cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
          currentPeriodEnd: typeof data.currentPeriodEnd === "number" ? data.currentPeriodEnd : null,
          status: typeof data.status === "string" ? data.status : null,
        });
      }
    } catch {
      // Ignore transient errors; UI falls back to plan data.
    }
  };

  useEffect(() => {
    loadSubscriptionInfo();
  }, [plan?.stripeSubscriptionId]);

  const startCheckout = async () => {
    setLoadingCheckout(true);
    try {
      let pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!pk) {
        const configRes = await fetch("/api/stripe/config");
        const config = await configRes.json();
        pk = config.publishableKey ?? null;
      }
      if (!pk) {
        alert("Stripe não configurado. Verifique NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no Vercel.");
        setLoadingCheckout(false);
        return;
      }
      const stripe = await loadStripe(pk);
      if (!stripe) {
        alert("Stripe.js não carregou. Tente novamente.");
        setLoadingCheckout(false);
        return;
      }
      const fetchClientSecret = async () => {
        const res = await fetch("/api/stripe/create-checkout-session", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          const msg = data.error ?? "Erro ao criar sessão de checkout.";
          if (msg.includes("Crie sua clínica primeiro")) {
            window.location.href = "/dashboard/onboarding";
          }
          throw new Error(msg);
        }
        const { clientSecret } = data;
        if (!clientSecret) {
          throw new Error(data.error ?? "Resposta inválida do servidor. Verifique o console (F12).");
        }
        return clientSecret;
      };
      if (embeddedCheckoutRef.current) {
        embeddedCheckoutRef.current.destroy();
        embeddedCheckoutRef.current = null;
      }
      const checkout = await stripe.initEmbeddedCheckout({ fetchClientSecret });
      embeddedCheckoutRef.current = checkout;
      setCheckoutMounted(true);
      setTimeout(() => {
        const el = document.getElementById("stripe-embedded-checkout");
        if (el) {
          el.innerHTML = "";
          checkout.mount("#stripe-embedded-checkout");
        }
      }, 100);
    } catch (e) {
      console.error("Checkout error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Erro ao iniciar checkout: ${msg}`);
    }
    setLoadingCheckout(false);
  };

  useEffect(() => {
    return () => {
      if (embeddedCheckoutRef.current) {
        embeddedCheckoutRef.current.destroy();
        embeddedCheckoutRef.current = null;
      }
    };
  }, []);

  const handleCancelSubscription = async () => {
    setCanceling(true);
    try {
      const res = await fetch("/api/stripe/cancel-subscription", { method: "POST" });
      const data = await res.json();
      console.log("cancel-subscription response:", { ok: res.ok, status: res.status, data });
      if (!res.ok) {
        alert(data.error ?? "Erro ao cancelar.");
        setCanceling(false);
        setCancelOpen(false);
        return;
      }
      if (res.ok) {
        setSubscriptionInfo({
          cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
          currentPeriodEnd: typeof data.currentPeriodEnd === "number" ? data.currentPeriodEnd : null,
          status: typeof data.status === "string" ? data.status : null,
        });
      }
      setCancelOpen(false);
      await loadSubscriptionInfo();
      router.refresh();
    } catch {
      alert("Erro ao cancelar.");
    }
    setCanceling(false);
  };

  const openPortal = async () => {
    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else alert(data.error ?? "Erro ao abrir portal.");
    } catch {
      alert("Erro ao abrir portal.");
    }
  };

  const formatMoney = (cents: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };
  const formatDate = (ts: number) =>
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
      new Date(ts * 1000)
    );
  const formatDaysLeft = (ts: number) => {
    const diffMs = ts * 1000 - Date.now();
    const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return days;
  };

  if (!plan) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Carregando plano…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plano atual</CardTitle>
          <p className="text-sm text-muted-foreground">
            {plan.planName}
            {isPro && " · Assinatura ativa"}
            {isPro && isCancelScheduled && " · Cancelamento agendado"}
            {isProPastDue && " · Pagamento atrasado — atualize o cartão para manter o acesso"}
            {isCanceled && " · Assinatura cancelada"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscriptionInfo?.cancelAtPeriodEnd && subscriptionInfo.currentPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              Cancelamento agendado. Você mantém o Pro por{" "}
              {formatDaysLeft(subscriptionInfo.currentPeriodEnd)} dias (até{" "}
              {formatDate(subscriptionInfo.currentPeriodEnd)}).
            </p>
          )}
          {!isPro && (
            <>
              <Button onClick={startCheckout} disabled={loadingCheckout}>
                {loadingCheckout ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparando checkout…
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Assinar Pro
                  </>
                )}
              </Button>
              {!plan.proStripePriceId && (
                <p className="text-sm text-muted-foreground">
                  Se o checkout não abrir, configure o preço do plano Pro no Stripe e o campo{" "}
                  <code className="text-xs">stripe_price_id</code> na tabela <code className="text-xs">plans</code> no Supabase.
                </p>
              )}
            </>
          )}
          {isPro && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={openPortal}>
                <ExternalLink className="h-4 w-4" />
                Atualizar cartão / ver faturas na Stripe
              </Button>
              {isCancelScheduled ? (
                <Button variant="secondary" disabled>
                  Cancelamento agendado
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                  Cancelar assinatura
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {checkoutMounted && (
        <Card>
          <CardHeader>
            <CardTitle>Checkout</CardTitle>
            <p className="text-sm text-muted-foreground">Preencha os dados abaixo para assinar o plano Pro.</p>
          </CardHeader>
          <CardContent>
            <div id="stripe-embedded-checkout" ref={checkoutRef} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transações</CardTitle>
          <p className="text-sm text-muted-foreground">Histórico de faturas da sua clínica.</p>
        </CardHeader>
        <CardContent>
          {loadingInvoices ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fatura ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4">Data</th>
                    <th className="pb-2 pr-4">Valor</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="py-2 pr-4">{formatDate(inv.created)}</td>
                      <td className="py-2 pr-4">{formatMoney(inv.amount_paid, inv.currency)}</td>
                      <td className="py-2 pr-4 capitalize">{inv.status}</td>
                      <td className="py-2">
                        {inv.hosted_invoice_url && (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Ver fatura
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar assinatura"
        message="Sua assinatura será cancelada ao fim do período já pago. Você mantém acesso Pro até essa data. Deseja continuar?"
        confirmLabel="Cancelar assinatura"
        cancelLabel="Manter assinatura"
        variant="destructive"
        loading={canceling}
        onConfirm={handleCancelSubscription}
        onCancel={() => setCancelOpen(false)}
      />

    </div>
  );
}
