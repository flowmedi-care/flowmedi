import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { FormularioPreenchimento } from "./formulario-preenchimento";

export default async function FormularioPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_form_by_token", {
    p_token: token,
  });

  if (error) {
    console.error("get_form_by_token", error);
    notFound();
  }

  if (!data?.found) notFound();
  if (data.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Link expirado
          </h1>
          <p className="text-muted-foreground mt-2">
            Este link de formulário não está mais válido. Entre em contato com a
            clínica para receber um novo link.
          </p>
        </div>
      </div>
    );
  }

  const definition = Array.isArray(data.definition) ? data.definition : [];
  const responses = (data.responses ?? {}) as Record<string, unknown>;

  // Debug: verificar se os dados do paciente estão chegando
  console.log("Patient data:", {
    name: data.patient_name,
    email: data.patient_email,
    phone: data.patient_phone,
    age: data.patient_age,
  });

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        {data.clinic_logo_url && (
          <div className="flex justify-center mb-4">
            <img
              src={data.clinic_logo_url}
              alt="Logo da clínica"
              className="max-h-24 max-w-full object-contain"
              onError={(e) => {
                // Esconde a imagem se não carregar
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        <FormularioPreenchimento
          templateName={data.template_name ?? "Formulário"}
          definition={definition}
          initialResponses={responses}
          instanceId={data.id}
          token={token}
          readOnly={data.status === "respondido"}
          doctorLogoUrl={data.doctor_logo_url ?? null}
          patientData={{
            name: data.patient_name ?? null,
            email: data.patient_email ?? null,
            phone: data.patient_phone ?? null,
            age: data.patient_age ?? null,
          }}
        />
      </div>
    </div>
  );
}
