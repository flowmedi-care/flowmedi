"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  FileDown,
  Send,
  Check,
  X,
  Save,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientCombobox, type PatientOption } from "@/components/patient-combobox";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import {
  createQuote,
  deleteQuote,
  getQuotePdfHtml,
  getServiceDefaultPrice,
  updateQuote,
  updateQuoteStatus,
} from "./actions";
import {
  DEFAULT_QUOTE_TERMS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_VARIANTS,
  type QuoteDetail,
  type QuoteInput,
  type QuoteItemInput,
  type QuoteItemSection,
  type QuoteStatus,
} from "@/lib/quotes/types";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Catalogs = {
  services: { id: string; nome: string; categoria: string | null }[];
  products: { id: string; name: string; sale_price: number | null; unit: string }[];
  professionals: { id: string; name: string }[];
  leads: { id: string; name: string | null; email: string; phone: string | null }[];
};

type LinkMode = "patient" | "lead" | "standalone";

function emptyItem(section: QuoteItemSection): QuoteItemInput {
  return {
    item_type: section === "materials" ? "product" : "service",
    description: "",
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    section,
    bill_separately: section === "materials",
  };
}

function detectLinkMode(quote?: QuoteDetail | null): LinkMode {
  if (quote?.patient_id) return "patient";
  if (quote?.pipeline_id) return "lead";
  return "standalone";
}

export function QuoteEditorClient({
  quote,
  catalogs,
}: {
  quote: QuoteDetail | null;
  catalogs: Catalogs;
}) {
  const router = useRouter();
  const isNew = !quote;
  const readOnly = quote ? quote.status !== "rascunho" : false;

  const [linkMode, setLinkMode] = useState<LinkMode>(detectLinkMode(quote));
  const [patient, setPatient] = useState<PatientOption | null>(
    quote?.patient_id
      ? { id: quote.patient_id, full_name: quote.patient_name, phone: quote.recipient_phone ?? undefined }
      : null
  );
  const [pipelineId, setPipelineId] = useState(quote?.pipeline_id ?? "");
  const [recipientName, setRecipientName] = useState(quote?.recipient_name ?? "");
  const [recipientPhone, setRecipientPhone] = useState(quote?.recipient_phone ?? "");
  const [recipientEmail, setRecipientEmail] = useState(quote?.recipient_email ?? "");
  const [professionalId, setProfessionalId] = useState(quote?.professional_id ?? "");
  const [validUntil, setValidUntil] = useState(quote?.valid_until ?? "");
  const [discountAmount, setDiscountAmount] = useState(String(quote?.discount_amount ?? 0));
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [terms, setTerms] = useState(quote?.terms ?? DEFAULT_QUOTE_TERMS);
  const [items, setItems] = useState<QuoteItemInput[]>(
    quote?.items.length
      ? quote.items.map(({ id: _id, ...rest }) => rest)
      : [emptyItem("services")]
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totals = useMemo(() => {
    const discount = Number(discountAmount) || 0;
    const billable = items.filter((i) => !(i.section === "materials" && i.bill_separately));
    const subtotal = billable.reduce((s, i) => s + Number(i.total_price), 0);
    const separate = items
      .filter((i) => i.section === "materials" && i.bill_separately)
      .reduce((s, i) => s + Number(i.total_price), 0);
    return {
      subtotal,
      separate,
      total: Math.max(0, subtotal - discount) + separate,
    };
  }, [items, discountAmount]);

  const buildInput = (): QuoteInput => ({
    patient_id: linkMode === "patient" ? patient?.id ?? null : null,
    pipeline_id: linkMode === "lead" ? pipelineId || null : null,
    recipient_name: linkMode === "standalone" ? recipientName : patient?.full_name ?? null,
    recipient_phone:
      linkMode === "standalone"
        ? recipientPhone
        : patient?.phone ?? recipientPhone ?? null,
    recipient_email: linkMode === "standalone" ? recipientEmail : recipientEmail || null,
    professional_id: professionalId || null,
    valid_until: validUntil || null,
    discount_amount: Number(discountAmount) || 0,
    notes: notes || null,
    terms: terms || DEFAULT_QUOTE_TERMS,
    items,
  });

  const updateItem = (index: number, patch: Partial<QuoteItemInput>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        const qty = Number(next.quantity) || 0;
        const unit = Number(next.unit_price) || 0;
        next.total_price = Math.round(qty * unit * 100) / 100;
        return next;
      })
    );
  };

  const addItem = (section: QuoteItemSection) => {
    setItems((prev) => [...prev, emptyItem(section)]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const input = buildInput();
      if (isNew) {
        const res = await createQuote(input);
        if (res.error) {
          setError(res.error);
          return;
        }
        router.push(`/dashboard/vendas/orcamentos/${res.id}`);
        router.refresh();
        return;
      }
      const res = await updateQuote(quote!.id, input);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const handleStatus = (status: QuoteStatus) => {
    if (!quote) return;
    setError(null);
    startTransition(async () => {
      const res = await updateQuoteStatus(quote.id, status);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const handleDelete = () => {
    if (!quote || !confirm("Excluir este rascunho?")) return;
    startTransition(async () => {
      const res = await deleteQuote(quote.id);
      if (res.error) setError(res.error);
      else router.push("/dashboard/vendas/orcamentos");
    });
  };

  const handlePdf = () => {
    if (!quote) return;
    startTransition(async () => {
      const res = await getQuotePdfHtml(quote.id);
      if (res.error || !res.html) {
        setError(res.error ?? "Erro ao gerar PDF.");
        return;
      }
      const win = window.open("", "_blank");
      if (!win) {
        setError("Permita pop-ups para visualizar o PDF.");
        return;
      }
      win.document.write(res.html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    });
  };

  const handleAddService = async (serviceId: string) => {
    const service = catalogs.services.find((s) => s.id === serviceId);
    if (!service) return;
    const priceRes = await getServiceDefaultPrice(serviceId, professionalId || null);
    const unitPrice = priceRes.price ?? 0;
    setItems((prev) => [
      ...prev,
      {
        item_type: "service",
        reference_id: serviceId,
        description: service.nome,
        quantity: 1,
        unit_price: unitPrice,
        total_price: unitPrice,
        section: "services",
        bill_separately: false,
      },
    ]);
  };

  const handleAddProduct = (productId: string, separate: boolean) => {
    const product = catalogs.products.find((p) => p.id === productId);
    if (!product) return;
    const unitPrice = product.sale_price ?? 0;
    setItems((prev) => [
      ...prev,
      {
        item_type: "product",
        reference_id: productId,
        description: product.name,
        quantity: 1,
        unit_price: unitPrice,
        total_price: unitPrice,
        section: "materials",
        bill_separately: separate,
      },
    ]);
  };

  const renderItemsSection = (section: QuoteItemSection, title: string) => {
    const sectionItems = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.section === section);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{title}</h3>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={() => addItem(section)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Linha manual
            </Button>
          )}
        </div>
        {sectionItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item nesta seção.</p>
        ) : (
          <div className="space-y-2">
            {sectionItems.map(({ item, index }) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_80px_100px_100px_auto]"
              >
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="Descrição"
                  disabled={readOnly}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                  disabled={readOnly}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                  disabled={readOnly}
                />
                <div className="flex items-center text-sm font-medium tabular-nums">
                  {fmt(item.total_price)}
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "Vendas", href: "/dashboard/vendas" },
          { label: "Orçamentos", href: "/dashboard/vendas/orcamentos" },
          { label: isNew ? "Novo" : `#${String(quote?.quote_number ?? 0).padStart(4, "0")}` },
        ],
        title: isNew ? "Novo orçamento" : `Orçamento #${String(quote?.quote_number ?? 0).padStart(4, "0")}`,
        description: readOnly
          ? "Visualização da proposta. Gere o PDF para enviar ao cliente."
          : "Monte a proposta com serviços, materiais e condições comerciais.",
        actions: (
          <div className="flex flex-wrap gap-2">
            {quote && (
              <Badge variant={QUOTE_STATUS_VARIANTS[quote.status]}>
                {QUOTE_STATUS_LABELS[quote.status]}
              </Badge>
            )}
            {quote && (
              <Button type="button" variant="outline" size="sm" onClick={handlePdf} disabled={isPending}>
                <FileDown className="h-4 w-4 mr-1" />
                Gerar PDF
              </Button>
            )}
            {!readOnly && (
              <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
                <Save className="h-4 w-4 mr-1" />
                Salvar
              </Button>
            )}
            {quote?.status === "rascunho" && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleStatus("enviado")}
                disabled={isPending}
              >
                <Send className="h-4 w-4 mr-1" />
                Marcar enviado
              </Button>
            )}
            {quote?.status === "enviado" && (
              <>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => handleStatus("aceito")}
                  disabled={isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Aceito
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatus("recusado")}
                  disabled={isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Recusado
                </Button>
              </>
            )}
            {quote?.status === "rascunho" && (
              <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={isPending}>
                Excluir
              </Button>
            )}
          </div>
        ),
      }}
    >
      <div className="space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Destinatário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={linkMode}
                onValueChange={(v) => {
                  if (!readOnly) setLinkMode(v as LinkMode);
                }}
              >
                <TabsList className={readOnly ? "pointer-events-none opacity-60" : undefined}>
                  <TabsTrigger value="patient">
                    Paciente
                  </TabsTrigger>
                  <TabsTrigger value="lead">
                    Lead
                  </TabsTrigger>
                  <TabsTrigger value="standalone">
                    Avulso
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="patient" className="mt-4">
                  <PatientCombobox
                    value={patient}
                    onChange={setPatient}
                    disabled={readOnly}
                  />
                </TabsContent>
                <TabsContent value="lead" className="mt-4 space-y-2">
                  <Label>Lead do CRM</Label>
                  <Select
                    value={pipelineId || "none"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPipelineId(v === "none" ? "" : v);
                      const lead = catalogs.leads.find((l) => l.id === v);
                      if (lead) {
                        setRecipientPhone(lead.phone ?? "");
                        setRecipientEmail(lead.email);
                      }
                    }}
                    disabled={readOnly}
                  >
                    <option value="none">Selecionar…</option>
                    {catalogs.leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.name ?? lead.email}
                      </option>
                    ))}
                  </Select>
                </TabsContent>
                <TabsContent value="standalone" className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Nome</Label>
                    <Input
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Telefone</Label>
                    <Input
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Condições</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Profissional</Label>
                <Select
                  value={professionalId || "none"}
                  onChange={(e) => setProfessionalId(e.target.value === "none" ? "" : e.target.value)}
                  disabled={readOnly}
                >
                  <option value="none">Não informado</option>
                  {catalogs.professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Validade</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-1">
                <Label>Desconto (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{fmt(totals.subtotal)}</span>
                </div>
                {totals.separate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Materiais à parte</span>
                    <span>{fmt(totals.separate)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-1 border-t">
                  <span>Total</span>
                  <span>{fmt(totals.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itens da proposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <Select
                  defaultValue=""
                  className="w-[220px]"
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) void handleAddService(id);
                    e.target.value = "";
                  }}
                >
                  <option value="">+ Serviço do catálogo</option>
                  {catalogs.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </Select>
                <Select
                  defaultValue=""
                  className="w-[220px]"
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) handleAddProduct(id, false);
                    e.target.value = "";
                  }}
                >
                  <option value="">+ Material incluso</option>
                  {catalogs.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Select
                  defaultValue=""
                  className="w-[220px]"
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) handleAddProduct(id, true);
                    e.target.value = "";
                  }}
                >
                  <option value="">+ Material à parte</option>
                  {catalogs.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {renderItemsSection("services", "Serviços e procedimentos")}
            {renderItemsSection("materials", "Materiais")}
            {renderItemsSection("other", "Outros")}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1">
            <Label>Condições comerciais</Label>
            <Textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={4}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
