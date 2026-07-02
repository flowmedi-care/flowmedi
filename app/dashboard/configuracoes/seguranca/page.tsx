import { redirect } from "next/navigation";

export default function SegurancaRedirect() {
  redirect("/dashboard/configuracoes/privacidade#mfa");
}
