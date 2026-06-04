import { redirect } from "next/navigation";

/** Hub antigo: atalho para a fila operacional (primeiro item do grupo Atendimento). */
export default function AtendimentosHubPage() {
  redirect("/dashboard/atendimento");
}
