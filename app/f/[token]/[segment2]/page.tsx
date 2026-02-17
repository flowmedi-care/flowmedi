import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { FormularioPreenchimento } from "../formulario-preenchimento";
import { LogoImage } from "@/components/logo-image";

export default async function FormularioComSlugPage({
  params,
}: {
  params: Promise<{ token: string; segment2: string }>;
}) {
  try {
    const { token: formSlug, segment2: patientSlug } = await params;

    if (!formSlug || !patientSlug || typeof formSlug !== "string" || typeof patientSlug !== "string") {
      notFound();
    }

    const supabase = await createClient();

    // Buscar instância pelo slug composto (formSlug = nome formulário, patientSlug = nome paciente)
    const combinedSlug = `${formSlug}/${patientSlug}`;
    const { data: instanceData, error: slugError } = await supabase
      .from("form_instances")
      .select(`
        id,
        link_token
      `)
      .eq("slug", combinedSlug)
      .maybeSingle();

    if (slugError || !instanceData || !instanceData.link_token) {
      notFound();
    }

    const { data, error } = await supabase.rpc("get_form_by_token", {
      p_token: instanceData.link_token,
    });

    if (error || !data || !data.found) {
      notFound();
    }

    return renderForm(data, instanceData.link_token);
  } catch (error) {
    notFound();
  }
}

function renderForm(data: any, token: string) {
  if (data.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Link expirado</h1>
          <p className="text-muted-foreground mt-2">
            Este link de formulário não está mais válido. Entre em contato com a clínica para receber um novo link.
          </p>
        </div>
      </div>
    );
  }

  const definition = Array.isArray(data.definition) ? data.definition : [];
  const responses =
    data.responses && typeof data.responses === "object"
      ? (data.responses as Record<string, unknown>)
      : {};

  const patientData = {
    name:
      data.patient_name && typeof data.patient_name === "string" && data.patient_name.trim()
        ? data.patient_name.trim()
        : null,
    email:
      data.patient_email && typeof data.patient_email === "string" && data.patient_email.trim()
        ? data.patient_email.trim()
        : null,
    phone:
      data.patient_phone && typeof data.patient_phone === "string" && data.patient_phone.trim()
        ? data.patient_phone.trim()
        : null,
    age:
      typeof data.patient_age === "number" && !isNaN(data.patient_age) && data.patient_age > 0
        ? data.patient_age
        : null,
  };

  const templateName =
    data.template_name && typeof data.template_name === "string" && data.template_name.trim()
      ? data.template_name.trim()
      : "Formulário";
  const instanceId = data.id && typeof data.id === "string" && data.id.trim() ? data.id.trim() : "";
  if (!instanceId) notFound();

  const status = data.status && typeof data.status === "string" ? data.status : "pendente";
  const clinicLogoUrl =
    data.clinic_logo_url && typeof data.clinic_logo_url === "string" ? data.clinic_logo_url : null;
  const clinicLogoScale =
    typeof data.clinic_logo_scale === "number" &&
    data.clinic_logo_scale >= 50 &&
    data.clinic_logo_scale <= 200
      ? data.clinic_logo_scale
      : 100;
  const doctorLogoUrl =
    data.doctor_logo_url && typeof data.doctor_logo_url === "string" ? data.doctor_logo_url : null;
  const doctorLogoScale =
    typeof data.doctor_logo_scale === "number" &&
    data.doctor_logo_scale >= 50 &&
    data.doctor_logo_scale <= 200
      ? data.doctor_logo_scale
      : 100;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {clinicLogoUrl && (
          <div className="flex justify-center mb-12">
            <LogoImage
              src={clinicLogoUrl}
              alt="Logo da clínica"
              className="max-h-24 max-w-full object-contain"
              scale={clinicLogoScale}
            />
          </div>
        )}
        <div className={clinicLogoUrl ? "mt-4" : ""}>
          <FormularioPreenchimento
            templateName={templateName}
            definition={definition}
            initialResponses={responses}
            instanceId={instanceId}
            token={token}
            readOnly={status === "respondido"}
            doctorLogoUrl={doctorLogoUrl}
            doctorLogoScale={doctorLogoScale}
            patientData={patientData}
          />
        </div>
      </div>
    </div>
  );
}
