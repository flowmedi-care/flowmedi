import { redirect } from "next/navigation";

/** Segurança consolidada em Privacidade (sem MFA). */
export default function SegurancaPage() {
  redirect("/dashboard/configuracoes/privacidade");
}
