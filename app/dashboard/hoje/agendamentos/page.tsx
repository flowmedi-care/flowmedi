import { redirect } from "next/navigation";

export default function AgendaRedirect() {
  redirect("/dashboard/hoje?area=agenda");
}
