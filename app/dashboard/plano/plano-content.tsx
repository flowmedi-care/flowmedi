"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CreditCard, ExternalLink, Loader2, ArrowUpCircle } from "lucide-react";

type UpgradePlan = { id: string; name: string; slug: string; stripe_price_id: string | null; price_display?: string | null };
type AddressState = {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
};
type InvoiceItem = {
  id: string;
  created: number;
  amount_paid: number;
  currency: string;
  status: string;
  hosted_invoice_url?: string;
  description?: string;
};

type PlanoContentProps = {
  planName: string;
  planSlug: string;
  isPro: boolean;
  isCancelScheduled: boolean;
  isProPastDue: boolean;
  isCanceled: boolean;
  paymentMounted: boolean;
  subscriptionInfo: { cancelAtPeriodEnd?: boolean; currentPeriodEnd: number | null } | null;
  upgradePlans: UpgradePlan[];
  effectiveCheckoutSlug: string;
  effectiveCheckoutPlan: UpgradePlan | undefined;
  showCheckoutForm: boolean;
  loadingCheckout: boolean;
  onStartPlanChange: (slug: string) => void;
  planPrice: { formatted: string } | null;
  loadingPrice: boolean;
  planProStripePriceId: string | null;
  taxIdType: "cpf" | "cnpj";
  taxIdValue: string;
  taxIdError: string;
  address: AddressState;
  consentAccepted: boolean;
  confirmingPayment: boolean;
  loadingInvoices: boolean;
  invoices: InvoiceItem[];
  messageStats: {
    sentLast30Days: number;
    post24hStartsThisMonth: number | null;
    recentMessages: Array<{
      id: string;
      channel: string;
      type: string;
      sent_at: string;
    }>;
  } | null;
  cancelOpen: boolean;
  canceling: boolean;
  resuming: boolean;
  paymentElementRef: React.RefObject<HTMLDivElement | null>;
  onStartCheckout: () => void;
  onPaymentSubmit: (e: React.FormEvent) => void;
  onOpenPortal: () => void;
  onResumeSubscription: () => void;
  onCancelClick: () => void;
  onCancelConfirm: () => void;
  onCancelClose: () => void;
  formatTaxId: (value: string, type: "cpf" | "cnpj") => string;
  formatZipCode: (value: string) => string;
  formatDate: (ts: number) => string;
  formatDaysLeft: (ts: number) => number;
  formatMoney: (cents: number, currency: string) => string;
  setTaxIdType: (v: "cpf" | "cnpj") => void;
  setTaxIdValue: (v: string) => void;
  setTaxIdError: (v: string) => void;
  setAddress: React.Dispatch<React.SetStateAction<AddressState>>;
  setConsentAccepted: (v: boolean) => void;
  handleCEPInputChange: (value: string) => void;
};

const invoiceStatusPt: Record<string, string> = {
  paid: "Pago",
  draft: "Rascunho",
  open: "Aberto",
  uncollectible: "Inadimplente",
  void: "Anulado",
};
function invoiceStatusLabel(status: string): string {
  return invoiceStatusPt[status] ?? status;
}

export function PlanoContent(props: PlanoContentProps) {
  const router = useRouter();
  const {
    planName,
    planSlug,
    isPro,
    isCancelScheduled,
    isProPastDue,
    isCanceled,
    paymentMounted,
    subscriptionInfo,
    upgradePlans,
    effectiveCheckoutSlug,
    effectiveCheckoutPlan,
    showCheckoutForm,
    loadingCheckout,
    onStartPlanChange,
    planPrice,
    loadingPrice,
    planProStripePriceId,
    taxIdType,
    taxIdValue,
    taxIdError,
    address,
    consentAccepted,
    confirmingPayment,
    loadingInvoices,
    invoices,
    messageStats,
    cancelOpen,
    canceling,
    resuming,
    paymentElementRef,
    onStartCheckout,
    onPaymentSubmit,
    onOpenPortal,
    onResumeSubscription,
    onCancelClick,
    onCancelConfirm,
    onCancelClose,
    formatTaxId,
    formatZipCode,
    formatDate,
    formatDaysLeft,
    formatMoney,
    setTaxIdType,
    setTaxIdValue,
    setTaxIdError,
    setAddress,
    setConsentAccepted,
    handleCEPInputChange,
  } = props;

  const otherPlans = upgradePlans.filter((p) => p.slug !== planSlug);

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-medium">Plano atual</CardTitle>
                <p className="mt-1 text-2xl font-semibold text-foreground">{planName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isPro && !isCancelScheduled && "Assinatura ativa"}
                  {isPro && isCancelScheduled && "Cancelamento agendado para o fim do período"}
                  {isProPastDue && "Pagamento atrasado — atualize o cartão para manter o acesso"}
                  {isCanceled && "Assinatura cancelada"}
                </p>
              </div>
              {isPro && !paymentMounted && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={onOpenPortal}>
                    <ExternalLink className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Faturas e cartão</span>
                  </Button>
                  {isCancelScheduled ? (
                    <Button variant="outline" size="sm" onClick={onResumeSubscription} disabled={resuming}>
                      {resuming ? "Salvando…" : "Manter assinatura"}
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {subscriptionInfo?.cancelAtPeriodEnd && subscriptionInfo?.currentPeriodEnd && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                Seu acesso continua até {formatDate(subscriptionInfo.currentPeriodEnd)} (
                {formatDaysLeft(subscriptionInfo.currentPeriodEnd)} dias). Você pode manter a assinatura
                a qualquer momento.
              </div>
            )}
            {showCheckoutForm && effectiveCheckoutPlan?.stripe_price_id ? (
                  <form onSubmit={onPaymentSubmit} className="space-y-6">
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <h3 className="font-semibold mb-3">Detalhes do pedido</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Plano {effectiveCheckoutPlan?.name ?? "Pro"}</span>
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
                              setTaxIdValue(e.target.value.replace(/\D/g, ""));
                              setTaxIdError("");
                            }}
                            placeholder={taxIdType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                            maxLength={taxIdType === "cpf" ? 14 : 18}
                            className={taxIdError ? "border-destructive" : ""}
                          />
                          {taxIdError && <p className="text-sm text-destructive">{taxIdError}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Endereço de cobrança</Label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Digite o CEP e os campos serão preenchidos automaticamente
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zipCode">CEP <span className="text-destructive">*</span></Label>
                        <div className="relative">
                          <Input
                            id="zipCode"
                            value={formatZipCode(address.zipCode)}
                            onChange={(e) => handleCEPInputChange(e.target.value)}
                            placeholder="00000-000"
                            maxLength={9}
                            className="w-full"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="street">Rua <span className="text-destructive">*</span></Label>
                          <Input
                            id="street"
                            value={address.street}
                            onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))}
                            placeholder="Nome da rua"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="number">Número <span className="text-destructive">*</span></Label>
                          <Input
                            id="number"
                            value={address.number}
                            onChange={(e) => setAddress((prev) => ({ ...prev, number: e.target.value }))}
                            placeholder="123"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="complement">Complemento</Label>
                          <Input
                            id="complement"
                            value={address.complement}
                            onChange={(e) => setAddress((prev) => ({ ...prev, complement: e.target.value }))}
                            placeholder="Apto, Bloco, etc."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="neighborhood">Bairro</Label>
                          <Input
                            id="neighborhood"
                            value={address.neighborhood}
                            onChange={(e) => setAddress((prev) => ({ ...prev, neighborhood: e.target.value }))}
                            placeholder="Nome do bairro"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">Cidade <span className="text-destructive">*</span></Label>
                          <Input
                            id="city"
                            value={address.city}
                            onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))}
                            placeholder="Nome da cidade"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">Estado <span className="text-destructive">*</span></Label>
                          <Input
                            id="state"
                            value={address.state}
                            onChange={(e) =>
                              setAddress((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))
                            }
                            placeholder="SP"
                            maxLength={2}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Dados do cartão</Label>
                      <div ref={paymentElementRef as React.Ref<HTMLDivElement>} className="border rounded-lg p-4 min-h-[200px]" />
                    </div>
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
                          Você concorda que a FlowMedi cobrará do seu cartão o valor acima agora e de forma
                          recorrente mensalmente até que você cancele. Você pode cancelar a qualquer momento.
                        </Label>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={confirmingPayment || !consentAccepted}
                      className="w-full"
                    >
                      {confirmingPayment ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processando pagamento…
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Assinar {effectiveCheckoutPlan?.name ?? "Plano"}
                        </>
                      )}
                    </Button>
                  </form>
            ) : !isPro && upgradePlans.length > 0 ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Escolha o plano</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {upgradePlans.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => router.push(`/dashboard/plano?plan=${p.slug}`)}
                        className={
                          effectiveCheckoutSlug === p.slug
                            ? "rounded-lg px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground"
                            : "rounded-lg px-3 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        }
                      >
                        {p.name}
                        {p.price_display && (
                          <span className="ml-1 opacity-90">({p.price_display})</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {effectiveCheckoutPlan?.stripe_price_id ? (
                  <Button onClick={onStartCheckout} disabled={loadingCheckout} className="w-full">
                    {loadingCheckout ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Preparando checkout…
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Assinar {effectiveCheckoutPlan?.name ?? "Plano"}
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">
                      Plano {effectiveCheckoutPlan?.name ?? ""}
                    </p>
                    <p>
                      Este plano requer contato comercial. Entre em contato conosco para mais informações.
                    </p>
                  </div>
                )}
              </>
            ) : null}
            {isPro && !isCancelScheduled && otherPlans.length > 0 && !showCheckoutForm && (
              <div className="pt-4 mt-4 border-t border-border space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Quer um plano melhor?</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Troque de plano facilmente. O valor será ajustado de forma proporcional.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {otherPlans.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={loadingCheckout}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onStartPlanChange(p.slug);
                        }}
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium h-9 px-3 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                      >
                        {loadingCheckout ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                            Preparando…
                          </>
                        ) : (
                          <>
                            <ArrowUpCircle className="h-4 w-4 shrink-0" />
                            Trocar para {p.name}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onCancelClick}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  Cancelar assinatura
                </button>
              </div>
            )}
            {isPro && !isCancelScheduled && otherPlans.length === 0 && (
              <div className="pt-4 mt-4 border-t border-border">
                <button
                  type="button"
                  onClick={onCancelClick}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  Cancelar assinatura
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Faturas</CardTitle>
          <p className="text-sm text-muted-foreground">Histórico de cobranças</p>
        </CardHeader>
        <CardContent>
          {loadingInvoices ? (
            <p className="text-sm text-muted-foreground py-4">Carregando…</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma fatura.</p>
          ) : (
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[320px]">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4">Data</th>
                    <th className="pb-2 pr-4">Descrição</th>
                    <th className="pb-2 pr-4">Valor</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="py-2 pr-4">{formatDate(inv.created)}</td>
                      <td className="py-2 pr-4">{inv.description ?? "—"}</td>
                      <td className="py-2 pr-4">{formatMoney(inv.amount_paid, inv.currency)}</td>
                      <td className="py-2 pr-4">{invoiceStatusLabel(inv.status)}</td>
                      <td className="py-2">
                        {inv.hosted_invoice_url ? (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Ver fatura
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{formatDate(inv.created)}</p>
                  <p className="text-muted-foreground">{inv.description ?? "—"}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span>{formatMoney(inv.amount_paid, inv.currency)}</span>
                    <span className="text-muted-foreground">{invoiceStatusLabel(inv.status)}</span>
                  </div>
                  {inv.hosted_invoice_url && (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Ver fatura
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Histórico de mensagens enviadas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visão rápida de envios e custo potencial do WhatsApp fora da janela de 24h.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!messageStats ? (
            <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Mensagens enviadas (30 dias)</p>
                  <p className="text-xl font-semibold">{messageStats.sentLast30Days}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Inícios pós-24h no mês (WhatsApp)</p>
                  <p className="text-xl font-semibold">
                    {messageStats.post24hStartsThisMonth === null ? "N/D" : messageStats.post24hStartsThisMonth}
                  </p>
                </div>
              </div>

              {messageStats.recentMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma mensagem registrada ainda.</p>
              ) : (
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm min-w-[320px]">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-4">Data</th>
                        <th className="pb-2 pr-4">Canal</th>
                        <th className="pb-2 pr-4">Evento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messageStats.recentMessages.map((msg) => (
                        <tr key={msg.id} className="border-b">
                          <td className="py-2 pr-4">
                            {new Date(msg.sent_at).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-2 pr-4 capitalize">{msg.channel}</td>
                          <td className="py-2 pr-4">{msg.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden space-y-2">
                  {messageStats.recentMessages.map((msg) => (
                    <div key={msg.id} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium capitalize">{msg.channel}</p>
                      <p className="text-muted-foreground break-all">{msg.type}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(msg.sent_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
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
        onConfirm={onCancelConfirm}
        onCancel={onCancelClose}
      />
    </div>
  );
}
