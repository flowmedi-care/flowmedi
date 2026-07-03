import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listClinicalDocumentsByType } from "../actions";
import { DocumentosHubClient } from "../documentos-hub-client";

async function getIsDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "medico";
}

export default async function PedidosExamePage() {
  const [{ data, error }, isDoctor] = await Promise.all([
    listClinicalDocumentsByType("exam_request"),
    getIsDoctor(),
  ]);

  return (
    <>
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      <DocumentosHubClient
        type="exam_request"
        isDoctor={isDoctor}
        initialItems={(data ?? []).map((d) => ({
          id: d.id,
          created_at: d.created_at,
          patient_name: d.patient_name,
          patient_id: d.patient_id,
          doctor_name: d.doctor_name,
          appointment_id: d.appointment_id,
          body_rendered: d.body_rendered,
          pdf_path: d.pdf_path,
        }))}
      />
    </>
  );
}
