import { redirect } from "next/navigation";

export default function PrivacidadeSolicitacoesRedirect() {
  redirect("/dashboard/configuracoes/privacidade#solicitacoes");
}
