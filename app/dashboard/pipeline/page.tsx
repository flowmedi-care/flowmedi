import { redirect } from "next/navigation";

/** Legado /dashboard/pipeline → Hoje */
export default function PipelineRedirectPage() {
  redirect("/dashboard/hoje");
}
