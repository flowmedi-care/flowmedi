import { redirect } from "next/navigation";

/** Políticas de objetivos movidas para Assistente Virtual → Políticas da IA. */
export default function AgendamentoPolicyPage() {
  redirect("/dashboard/configuracoes/assistente-virtual");
}
