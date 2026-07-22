import { redirect } from "next/navigation";

export default function PessoasRedirect() {
  redirect("/dashboard/hoje?area=pessoas");
}
