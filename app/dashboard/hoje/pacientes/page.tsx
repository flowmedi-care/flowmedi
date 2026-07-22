import { redirect } from "next/navigation";

export default function PacientesOpsRedirect() {
  redirect("/dashboard/hoje?area=pacientes");
}
