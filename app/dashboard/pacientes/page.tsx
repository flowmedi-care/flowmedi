import { loadPacientesShell } from "./load-pacientes-data";
import { PacientesPageContent } from "./pacientes-page-content";

export default async function PacientesPage() {
  const shell = await loadPacientesShell();
  return <PacientesPageContent shell={shell} />;
}
