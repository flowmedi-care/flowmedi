"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Card, CardContent } from "@/components/ui/card";
import { PlanoContent } from "./plano-content";

type UpgradePlan = {
  id: string;
  name: string;
  slug: string;
  stripe_price_id: string;
};

type PlanInfo = {
  planName: string;
  planSlug: string;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  proStripePriceId: string | null;
  selectedPlanSlug?: string | null;
  upgradePlans?: UpgradePlan[];
  setupComplete?: boolean;
  setupSessionId?: string | null;
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
  const paymentElementRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<{ stripe: any; elements: any; paymentElement: any } | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [paymentMounted, setPaymentMounted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [resuming, setResuming] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [taxIdType, setTaxIdType] = useState<"cpf" | "cnpj">("cpf");
  const [taxIdValue, setTaxIdValue] = useState("");
  const [taxIdError, setTaxIdError] = useState("");
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [planPrice, setPlanPrice] = useState<{ amount: number; currency: string; formatted: string } | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  
  // Campos de endereço
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [address, setAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
  });

  const PAID_PLAN_SLUGS = ["pro", "profissional", "essencial", "estrategico"];
  const isPaidPlan = Boolean(plan?.planSlug && PAID_PLAN_SLUGS.includes(plan.planSlug));
  const isPro = isPaidPlan && plan?.subscriptionStatus === "active";
  const isProPastDue = isPaidPlan && plan?.subscriptionStatus === "past_due";

  const upgradePlans = plan?.upgradePlans ?? [];
  const effectiveCheckoutSlug =
    plan?.selectedPlanSlug && upgradePlans.some((p) => p.slug === plan.selectedPlanSlug)
      ? plan.selectedPlanSlug
      : upgradePlans[0]?.slug ?? "pro";
  const effectiveCheckoutPlan = upgradePlans.find((p) => p.slug === effectiveCheckoutSlug) ?? upgradePlans[0];
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

  // Carregar preço do plano selecionado para upgrade
  useEffect(() => {
    if (!isPro && effectiveCheckoutSlug) {
      setLoadingPrice(true);
      fetch(`/api/stripe/price?plan=${encodeURIComponent(effectiveCheckoutSlug)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.price && data.formatted) {
            setPlanPrice({
              amount: data.price.amount,
              currency: data.price.currency,
              formatted: data.formatted,
            });
          }
        })
        .finally(() => setLoadingPrice(false));
    }
  }, [isPro, effectiveCheckoutSlug]);

  const loadSubscriptionInfo = async () => {
    try {
      const res = await fetch("/api/stripe/subscription");
      const data = await res.json();
      if (res.ok) {
        setSubscriptionInfo({
          cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
          currentPeriodEnd: typeof data.currentPeriodEnd === "number" ? data.currentPeriodEnd : null,
          status: typeof data.status === "string" ? data.status : null,
        });
      } else {
        setSubscriptionInfo(null);
      }
    } catch {
      // Ignore transient errors; UI falls back to plan data.
    }
  };

  useEffect(() => {
    loadSubscriptionInfo();
  }, [plan?.stripeSubscriptionId]);

  useEffect(() => {
    if (paymentMounted && stripeRef.current?.paymentElement && paymentElementRef.current) {
      const mountElement = () => {
        if (paymentElementRef.current && stripeRef.current?.paymentElement) {
          paymentElementRef.current.innerHTML = "";
          try {
            stripeRef.current.paymentElement.mount(paymentElementRef.current);
          } catch (error) {
            console.error("Erro ao montar Payment Element:", error);
          }
        }
      };
      mountElement();
      const timeout = setTimeout(mountElement, 100);
      return () => clearTimeout(timeout);
    }
  }, [paymentMounted]);

  const formatTaxId = (value: string, type: "cpf" | "cnpj") => {
    const cleaned = value.replace(/\D/g, "");
    if (type === "cpf") {
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 6) return cleaned.replace(/(\d{3})(\d+)/, "$1.$2");
      if (cleaned.length <= 9) return cleaned.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else {
      if (cleaned.length <= 2) return cleaned;
      if (cleaned.length <= 5) return cleaned.replace(/(\d{2})(\d+)/, "$1.$2");
      if (cleaned.length <= 8) return cleaned.replace(/(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
      if (cleaned.length <= 12) return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
  };

  const validateTaxId = (value: string, type: "cpf" | "cnpj") => {
    const cleaned = value.replace(/\D/g, "");
    const expectedLength = type === "cpf" ? 11 : 14;
    return cleaned.length === expectedLength;
  };

  const startCheckout = async () => {
    setLoadingCheckout(true);
    try {
      const res = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: effectiveCheckoutSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? "Erro ao criar intenção de pagamento.";
        if (msg.includes("Crie sua clínica primeiro")) {
          window.location.href = "/dashboard/onboarding";
        }
        alert(msg);
        setLoadingCheckout(false);
        return;
      }

      const { clientSecret, paymentIntentId } = data;
      if (!clientSecret || !paymentIntentId) {
        alert("Resposta inválida do servidor.");
        setLoadingCheckout(false);
        return;
      }

      // Carregar Stripe.js primeiro
      let pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!pk) {
        const configRes = await fetch("/api/stripe/config");
        const config = await configRes.json();
        pk = config.publishableKey ?? null;
      }
      if (!pk) {
        alert("Stripe não configurado.");
        setLoadingCheckout(false);
        return;
      }

      const stripe = await loadStripe(pk);
      if (!stripe) {
        alert("Stripe.js não carregou.");
        setLoadingCheckout(false);
        return;
      }

      // Salvar dados antes de atualizar estado
      setClientSecret(clientSecret);
      setPaymentIntentId(paymentIntentId);
      
      // Criar Elements e Payment Element com paymentMethodCreation manual
      const elements = stripe.elements({
        clientSecret,
        paymentMethodCreation: "manual",
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#2563eb",
          },
        },
      });

      const paymentElement = elements.create("payment");
      
      stripeRef.current = { stripe, elements, paymentElement };
      
      // Atualizar estado para renderizar o elemento primeiro
      // O useEffect vai montar o Payment Element quando o elemento estiver no DOM
      setPaymentMounted(true);
    } catch (e) {
      console.error("Checkout error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Erro ao iniciar checkout: ${msg}`);
      // Resetar estado em caso de erro
      setPaymentMounted(false);
      setClientSecret(null);
      setPaymentIntentId(null);
      if (stripeRef.current?.paymentElement) {
        try {
          stripeRef.current.paymentElement.destroy();
        } catch (destroyError) {
          console.error("Erro ao destruir Payment Element:", destroyError);
        }
      }
      stripeRef.current = null;
    }
    setLoadingCheckout(false);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar consentimento
    if (!consentAccepted) {
      alert("Você precisa aceitar os termos para continuar.");
      return;
    }

    // Validar CPF/CNPJ
    const cleaned = taxIdValue.replace(/\D/g, "");
    if (!validateTaxId(taxIdValue, taxIdType)) {
      setTaxIdError(`O ${taxIdType === "cpf" ? "CPF" : "CNPJ"} deve ter ${taxIdType === "cpf" ? 11 : 14} dígitos.`);
      return;
    }

    // Validar endereço básico
    if (!address.street || !address.number || !address.city || !address.state || !address.zipCode) {
      alert("Por favor, preencha todos os campos obrigatórios do endereço.");
      return;
    }

    if (!stripeRef.current || !clientSecret || !paymentIntentId) {
      return;
    }

    // Prevenir múltiplos cliques
    if (confirmingPayment) {
      return;
    }

    setTaxIdError("");
    setConfirmingPayment(true);

    try {
      const { stripe, elements } = stripeRef.current;

      // Primeiro, validar os elementos do Payment Element
      const { error: submitError } = await elements.submit();
      
      if (submitError) {
        throw submitError;
      }

      // Depois, criar o payment method
      const { error: createError, paymentMethod } = await stripe.createPaymentMethod({
        elements,
      });

      if (createError || !paymentMethod) {
        throw createError || new Error("Erro ao criar método de pagamento.");
      }

      // Confirmar pagamento e criar assinatura no backend
      const subRes = await fetch("/api/stripe/confirm-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId,
          paymentMethodId: paymentMethod.id,
          taxId: cleaned,
          taxIdType,
          address,
        }),
      });

      const subData = await subRes.json();
      if (!subRes.ok) {
        throw new Error(subData.error ?? "Erro ao processar pagamento.");
      }

      // Sucesso - atualizar página
      router.refresh();
      window.location.reload();
    } catch (e) {
      console.error("Payment confirmation error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Erro ao processar pagamento: ${msg}`);
    } finally {
      setConfirmingPayment(false);
    }
  };

  const formatZipCode = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 5) return cleaned;
    return cleaned.replace(/(\d{5})(\d+)/, "$1-$2");
  };

  // Buscar endereço por CEP usando ViaCEP
  const fetchAddressByCEP = async (cep: string) => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) return;

    setLoadingCEP(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        alert("CEP não encontrado. Verifique se o CEP está correto.");
        setLoadingCEP(false);
        return;
      }

      // Preencher automaticamente os campos do endereço
      setAddress({
        street: data.logradouro || "",
        number: "",
        complement: "",
        neighborhood: data.bairro || "",
        city: data.localidade || "",
        state: data.uf || "",
        zipCode: cleaned,
      });
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      alert("Erro ao buscar CEP. Tente novamente.");
    } finally {
      setLoadingCEP(false);
    }
  };

  // Handler para mudança no input de CEP
  const handleCEPInputChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const formatted = cleaned.length <= 5 ? cleaned : cleaned.replace(/(\d{5})(\d+)/, "$1-$2");
    
    setAddress({ ...address, zipCode: cleaned });
    
    // Buscar automaticamente quando CEP estiver completo
    if (cleaned.length === 8) {
      fetchAddressByCEP(cleaned);
    }
  };

  useEffect(() => {
    return () => {
      if (stripeRef.current?.paymentElement) {
        try {
          stripeRef.current.paymentElement.destroy();
        } catch (e) {
          console.error("Erro ao destruir Payment Element:", e);
        }
        stripeRef.current = null;
      }
    };
  }, []);

  const handleCancelSubscription = async () => {
    setCanceling(true);
    try {
      const res = await fetch("/api/stripe/cancel-subscription", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Erro ao cancelar.");
        setCanceling(false);
        setCancelOpen(false);
        return;
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

  const handleResumeSubscription = async () => {
    setResuming(true);
    try {
      const res = await fetch("/api/stripe/resume-subscription", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Erro ao manter assinatura.");
        setResuming(false);
        return;
      }
      await loadSubscriptionInfo();
      router.refresh();
    } catch {
      alert("Erro ao manter assinatura.");
    }
    setResuming(false);
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
    <PlanoContent
      planName={plan.planName}
      planSlug={plan.planSlug}
      setupComplete={plan.setupComplete}
      setupSessionId={plan.setupSessionId}
      isPro={isPro}
      isCancelScheduled={isCancelScheduled}
      isProPastDue={isProPastDue}
      isCanceled={isCanceled}
      paymentMounted={paymentMounted}
      subscriptionInfo={subscriptionInfo}
      upgradePlans={upgradePlans}
      effectiveCheckoutSlug={effectiveCheckoutSlug}
      effectiveCheckoutPlan={effectiveCheckoutPlan}
      loadingCheckout={loadingCheckout}
      planPrice={planPrice}
      loadingPrice={loadingPrice}
      planProStripePriceId={plan.proStripePriceId}
      taxIdType={taxIdType}
      taxIdValue={taxIdValue}
      taxIdError={taxIdError}
      address={address}
      consentAccepted={consentAccepted}
      confirmingPayment={confirmingPayment}
      loadingInvoices={loadingInvoices}
      invoices={invoices}
      cancelOpen={cancelOpen}
      canceling={canceling}
      resuming={resuming}
      paymentElementRef={paymentElementRef}
      onStartCheckout={startCheckout}
      onPaymentSubmit={handlePaymentSubmit}
      onOpenPortal={openPortal}
      onResumeSubscription={handleResumeSubscription}
      onCancelClick={() => setCancelOpen(true)}
      onCancelConfirm={handleCancelSubscription}
      onCancelClose={() => setCancelOpen(false)}
      formatTaxId={formatTaxId}
      formatZipCode={formatZipCode}
      formatDate={formatDate}
      formatDaysLeft={formatDaysLeft}
      formatMoney={formatMoney}
      setTaxIdType={setTaxIdType}
      setTaxIdValue={setTaxIdValue}
      setTaxIdError={setTaxIdError}
      setAddress={setAddress}
      setConsentAccepted={setConsentAccepted}
      handleCEPInputChange={handleCEPInputChange}
    />
  );
}
