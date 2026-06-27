import { notFound } from "next/navigation";
import { getQuote, listQuoteCatalogs } from "../actions";
import { QuoteEditorClient } from "../quote-editor-client";

export default async function OrcamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quoteRes, catalogs] = await Promise.all([getQuote(id), listQuoteCatalogs()]);

  if (quoteRes.error || !quoteRes.data) {
    if (quoteRes.error === "Orçamento não encontrado.") notFound();
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Orçamento</h1>
        <p className="text-sm text-destructive">{quoteRes.error ?? "Erro ao carregar."}</p>
      </div>
    );
  }

  return (
    <QuoteEditorClient
      quote={quoteRes.data}
      catalogs={{
        services: catalogs.services,
        products: catalogs.products,
        professionals: catalogs.professionals,
        leads: catalogs.leads,
      }}
    />
  );
}
