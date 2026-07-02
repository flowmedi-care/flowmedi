import { redirect } from "next/navigation";

export default function PrivacidadeHubRedirect() {
  redirect("/dashboard/configuracoes/privacidade");
}
