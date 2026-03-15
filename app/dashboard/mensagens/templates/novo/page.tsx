import { redirect } from "next/navigation";

export default async function NovoTemplatePage() {
  redirect("/dashboard/mensagens/templates");
}
