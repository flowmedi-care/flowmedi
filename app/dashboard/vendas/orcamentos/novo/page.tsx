import { listQuoteCatalogs } from "./actions";
import { QuoteEditorClient } from "./quote-editor-client";

export default async function NovoOrcamentoPage() {
  const catalogs = await listQuoteCatalogs();

  if (catalogs.error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Novo orçamento</h1>
        <p className="text-sm text-destructive">{catalogs.error}</p>
      </div>
    );
  }

  return (
    <QuoteEditorClient
      quote={null}
      catalogs={{
        services: catalogs.services,
        products: catalogs.products,
        professionals: catalogs.professionals,
        leads: catalogs.leads,
      }}
    />
  );
}
