import { redirect } from "next/navigation";

/** Centro de Jornada removido — Workspace/board são o posto de trabalho. */
export default function CentroJornadaRedirect() {
  redirect("/dashboard/crm/jornada");
}
