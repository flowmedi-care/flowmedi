import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { FormularioPreenchimento } from "./formulario-preenchimento";

export default async function FormularioPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  try {
    const { token } = await params;
    
    if (!token || typeof token !== 'string') {
      notFound();
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_form_by_token", {
      p_token: token,
    });

    if (error || !data) {
      notFound();
    }

    if (!data.found) {
      notFound();
    }

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

    // Validar e sanitizar dados
    const definition = Array.isArray(data.definition) ? data.definition : [];
    const responses = (data.responses && typeof data.responses === 'object') 
      ? (data.responses as Record<string, unknown>) 
      : {};

    // Garantir que os dados do paciente sejam seguros
    const patientData = {
      name: (data.patient_name && typeof data.patient_name === 'string' && data.patient_name.trim()) 
        ? data.patient_name.trim() 
        : null,
      email: (data.patient_email && typeof data.patient_email === 'string' && data.patient_email.trim()) 
        ? data.patient_email.trim() 
        : null,
      phone: (data.patient_phone && typeof data.patient_phone === 'string' && data.patient_phone.trim()) 
        ? data.patient_phone.trim() 
        : null,
      age: (typeof data.patient_age === 'number' && !isNaN(data.patient_age) && data.patient_age > 0) 
        ? data.patient_age 
        : null,
    };

    const templateName = (data.template_name && typeof data.template_name === 'string' && data.template_name.trim()) 
      ? data.template_name.trim() 
      : "Formulário";
    
    const instanceId = (data.id && typeof data.id === 'string' && data.id.trim()) 
      ? data.id.trim() 
      : '';
    
    if (!instanceId) {
      notFound();
    }
    
    const status = (data.status && typeof data.status === 'string') 
      ? data.status 
      : 'pendente';
    const clinicLogoUrl = (data.clinic_logo_url && typeof data.clinic_logo_url === 'string') 
      ? data.clinic_logo_url 
      : null;
    const doctorLogoUrl = (data.doctor_logo_url && typeof data.doctor_logo_url === 'string') 
      ? data.doctor_logo_url 
      : null;

    return (
      <div className="min-h-screen bg-muted/30 py-8 px-4">
        <div className="max-w-xl mx-auto space-y-4">
          {clinicLogoUrl && (
            <div className="flex justify-center mb-4">
              <img
                src={clinicLogoUrl}
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
            templateName={templateName}
            definition={definition}
            initialResponses={responses}
            instanceId={instanceId}
            token={token}
            readOnly={status === "respondido"}
            doctorLogoUrl={doctorLogoUrl}
            patientData={patientData}
          />
        </div>
      </div>
    );
  } catch (error) {
    // Em caso de qualquer erro, retornar 404
    notFound();
  }
}
