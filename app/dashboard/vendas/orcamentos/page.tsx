import { listQuotes } from "./quote-service";
import { OrcamentosListClient } from "./orcamentos-list-client";
import { listProcedureQuoteSettings } from "./quote-ai-settings-actions";
import { OrcamentoAiSettings } from "./orcamento-ai-settings";

export default async function VendasOrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const settingsRes = await listProcedureQuoteSettings();

  if (tab === "config") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Orçamentos — Configuração IA</h1>
        <OrcamentoAiSettings
          initialRows={settingsRes.data ?? []}
          initialValidityDays={settingsRes.quoteDefaultValidityDays}
          initialTerms={settingsRes.quoteDefaultTerms}
        />
      </div>
    );
  }

  const { data, error } = await listQuotes();

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Orçamentos</h1>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return <OrcamentosListClient quotes={data} />;
}
