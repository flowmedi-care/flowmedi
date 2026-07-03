import { loadAgendaShell } from "./load-agenda-data";
import { AgendaPageContent } from "./agenda-page-content";

export default async function AgendaPage() {
  const shell = await loadAgendaShell();
  return <AgendaPageContent shell={shell} />;
}
