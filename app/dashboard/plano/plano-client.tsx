"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  const [address, setAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
  });

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

  // Carregar preço do plano Pro
  useEffect(() => {
    if (!isPro) {
      setLoadingPrice(true);
      fetch("/api/stripe/price")
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
  }, [isPro]);

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

  // Montar Payment Element quando paymentMounted for true e o elemento estiver no DOM
  useEffect(() => {
    if (paymentMounted && stripeRef.current?.paymentElement && paymentElementRef.current) {
      console.log("Tentando montar Payment Element...");
      const mountElement = () => {
        if (paymentElementRef.current && stripeRef.current?.paymentElement) {
          console.log("Montando Payment Element no elemento:", paymentElementRef.current);
          paymentElementRef.current.innerHTML = "";
          try {
            stripeRef.current.paymentElement.mount(paymentElementRef.current);
            console.log("Payment Element montado com sucesso!");
          } catch (error) {
            console.error("Erro ao montar Payment Element:", error);
          }
        } else {
          console.log("Elemento ou Payment Element não disponível:", {
            hasElement: !!paymentElementRef.current,
            hasPaymentElement: !!stripeRef.current?.paymentElement,
          });
        }
      };
      
      // Tentar montar imediatamente
      mountElement();
      
      // Se não funcionou, tentar após um pequeno delay
      const timeout = setTimeout(mountElement, 100);
      
      return () => clearTimeout(timeout);
    } else {
      console.log("Condições não atendidas para montar:", {
        paymentMounted,
        hasPaymentElement: !!stripeRef.current?.paymentElement,
        hasElement: !!paymentElementRef.current,
      });
    }
  }, [paymentMounted]);

  // Formatar CPF/CNPJ enquanto digita
  const formatTaxId = (value: string, type: "cpf" | "cnpj"): string => {
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

  const validateTaxId = (value: string, type: "cpf" | "cnpj"): boolean => {
    const cleaned = value.replace(/\D/g, "");
    const expectedLength = type === "cpf" ? 11 : 14;
    return cleaned.length === expectedLength;
  };

  const startCheckout = async () => {
    setLoadingCheckout(true);
    try {
      // Criar Payment Intent
      const res = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      console.log("Payment Intent criado:", { clientSecret: clientSecret?.substring(0, 20) + "...", paymentIntentId });
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
      
      // Criar Elements e Payment Element
      const elements = stripe.elements({
        clientSecret,
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

    setTaxIdError("");
    setConfirmingPayment(true);

    try {
      const { stripe, elements } = stripeRef.current;

      // Obter payment method do Payment Element
      const { error: submitError, paymentMethod } = await stripe.createPaymentMethod({
        elements,
      });

      if (submitError || !paymentMethod) {
        throw submitError || new Error("Erro ao criar método de pagamento.");
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

  const formatZipCode = (value: string): string => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 5) return cleaned;
    return cleaned.replace(/(\d{5})(\d+)/, "$1-$2");
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
              Cancelamento agendado — seu acesso continua por{" "}
              {formatDaysLeft(subscriptionInfo.currentPeriodEnd)} dias (até{" "}
              {formatDate(subscriptionInfo.currentPeriodEnd)}). Você pode manter a assinatura a
              qualquer momento.
            </p>
          )}
          {!isPro && (
            <>
              {!paymentMounted ? (
                <Button onClick={startCheckout} disabled={loadingCheckout} className="w-full">
                  {loadingCheckout ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Preparando checkout…
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Assinar Pro
                    </>
                  )}
                </Button>
              ) : (
                <form onSubmit={handlePaymentSubmit} className="space-y-6">
                  {/* Detalhes do pedido */}
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h3 className="font-semibold mb-3">Detalhes do pedido</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Plano Pro</span>
                        <span className="text-sm font-medium">
                          {loadingPrice ? (
                            <Loader2 className="h-4 w-4 animate-spin inline" />
                          ) : planPrice ? (
                            planPrice.formatted
                          ) : (
                            "Carregando..."
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Cobrança mensal recorrente</span>
                        <span>Cancelável a qualquer momento</span>
                      </div>
                    </div>
                  </div>

                  {/* CPF/CNPJ */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Dados para nota fiscal</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Informe seu CPF ou CNPJ para emissão da nota fiscal
                      </p>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="tax_id_type">Tipo de documento</Label>
                        <Select
                          id="tax_id_type"
                          value={taxIdType}
                          onChange={(e) => {
                            setTaxIdType(e.target.value as "cpf" | "cnpj");
                            setTaxIdValue("");
                            setTaxIdError("");
                          }}
                        >
                          <option value="cpf">CPF (Pessoa Física)</option>
                          <option value="cnpj">CNPJ (Pessoa Jurídica)</option>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tax_id_value">
                          {taxIdType === "cpf" ? "CPF" : "CNPJ"} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="tax_id_value"
                          value={formatTaxId(taxIdValue, taxIdType)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            setTaxIdValue(value);
                            setTaxIdError("");
                          }}
                          placeholder={taxIdType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                          maxLength={taxIdType === "cpf" ? 14 : 18}
                          className={taxIdError ? "border-destructive" : ""}
                        />
                        {taxIdError && (
                          <p className="text-sm text-destructive">{taxIdError}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Endereço de cobrança</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Preencha os dados do endereço para emissão da nota fiscal
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="street">Rua <span className="text-destructive">*</span></Label>
                        <Input
                          id="street"
                          value={address.street}
                          onChange={(e) => setAddress({ ...address, street: e.target.value })}
                          placeholder="Nome da rua"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="number">Número <span className="text-destructive">*</span></Label>
                        <Input
                          id="number"
                          value={address.number}
                          onChange={(e) => setAddress({ ...address, number: e.target.value })}
                          placeholder="123"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="complement">Complemento</Label>
                        <Input
                          id="complement"
                          value={address.complement}
                          onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                          placeholder="Apto, Bloco, etc."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="neighborhood">Bairro</Label>
                        <Input
                          id="neighborhood"
                          value={address.neighborhood}
                          onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                          placeholder="Nome do bairro"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city">Cidade <span className="text-destructive">*</span></Label>
                        <Input
                          id="city"
                          value={address.city}
                          onChange={(e) => setAddress({ ...address, city: e.target.value })}
                          placeholder="Nome da cidade"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="state">Estado <span className="text-destructive">*</span></Label>
                        <Input
                          id="state"
                          value={address.state}
                          onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })}
                          placeholder="SP"
                          maxLength={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="zipCode">CEP <span className="text-destructive">*</span></Label>
                        <Input
                          id="zipCode"
                          value={formatZipCode(address.zipCode)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            setAddress({ ...address, zipCode: value });
                          }}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Element */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Dados do cartão</Label>
                    <div 
                      ref={paymentElementRef} 
                      className="border rounded-lg p-4 min-h-[200px]" 
                      style={{ minHeight: '200px' }}
                    />
                  </div>

                  {/* Cláusula de consentimento */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="consent"
                        checked={consentAccepted}
                        onChange={(e) => setConsentAccepted(e.target.checked)}
                        className="mt-1"
                      />
                      <Label htmlFor="consent" className="text-sm cursor-pointer">
                        Você concorda que a FlowMedi cobrará do seu cartão o valor acima agora e de forma recorrente mensalmente até que você cancele de acordo com nossos{" "}
                        <a href="/termos" target="_blank" className="text-primary underline" rel="noopener noreferrer">
                          termos
                        </a>
                        . Você pode cancelar a qualquer momento nas configurações da sua conta.
                      </Label>
                    </div>
                  </div>

                  {/* Botão de pagamento */}
                  <Button type="submit" disabled={confirmingPayment || !consentAccepted} className="w-full">
                    {confirmingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processando pagamento…
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Assinar Pro
                      </>
                    )}
                  </Button>
                </form>
              )}
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
                <Button variant="outline" onClick={handleResumeSubscription} disabled={resuming}>
                  {resuming ? "Mantendo…" : "Manter assinatura"}
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
