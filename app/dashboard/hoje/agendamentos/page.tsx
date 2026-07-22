import { redirect } from "next/navigation";

export default function AgendamentosRedirect() {
  redirect("/dashboard/hoje?area=agendamentos");
}
