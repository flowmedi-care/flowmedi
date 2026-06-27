import { listQuotes } from "./actions";
import { OrcamentosListClient } from "./orcamentos-list-client";

export default async function VendasOrcamentosPage() {
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
