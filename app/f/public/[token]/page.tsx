import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { FormularioPublicoPreenchimento } from "./formulario-publico-preenchimento";
import { LogoImage } from "@/components/logo-image";

export default async function FormularioPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  try {
    const { token } = await params;

    if (!token || typeof token !== "string") {
      notFound();
    }

    const supabase = await createClient();
    
    // Tentar interpretar token como template_id (UUID) ou como link_token antigo
    let templateId: string | null = null;
    let isOldToken = false;
    
    // Verificar se é UUID (template_id) ou token antigo
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(token)) {
      templateId = token;
    } else {
      // Token antigo - buscar instância
      isOldToken = true;
      const { data: oldData, error: oldError } = await supabase.rpc("get_form_by_token", {
        p_token: token,
      });
      if (oldError || !oldData?.found || !oldData?.is_public) {
        notFound();
      }
      templateId = oldData.form_template_id;
    }
    
    if (!templateId) {
      notFound();
    }

    // Buscar template público diretamente
    const { data, error } = await supabase.rpc("get_public_form_template", {
      p_template_id: templateId,
    });

    if (error || !data) {
      notFound();
    }

    if (!data.found) {
      notFound();
    }

    // Validar e sanitizar dados
    const definition = Array.isArray(data.definition) ? data.definition : [];
    const responses: Record<string, unknown> = {}; // Sempre vazio para nova resposta

    const templateName =
      (data.template_name && typeof data.template_name === "string" && data.template_name.trim())
        ? data.template_name.trim()
        : "Formulário";

    const templateIdStr = String(data.template_id || templateId);

    const status = (data.status && typeof data.status === "string") ? data.status : "pendente";
    const clinicLogoUrl =
      (data.clinic_logo_url && typeof data.clinic_logo_url === "string")
        ? data.clinic_logo_url
        : null;
    const clinicLogoScale =
      typeof data.clinic_logo_scale === "number" &&
      data.clinic_logo_scale >= 50 &&
      data.clinic_logo_scale <= 200
        ? data.clinic_logo_scale
        : 100;

    // Buscar campos customizados que devem aparecer no formulário público
    const clinicId = data.clinic_id ? String(data.clinic_id) : null;
    let customFields: Array<{
      id: string;
      field_name: string;
      field_type: "text" | "number" | "date" | "textarea" | "select";
      field_label: string;
      required: boolean;
      options: string[] | null;
      display_order: number;
    }> = [];

    if (clinicId) {
      const { data: fields } = await supabase
        .from("patient_custom_fields")
        .select("id, field_name, field_type, field_label, required, options, display_order")
        .eq("clinic_id", clinicId)
        .eq("include_in_public_form", true)
        .order("display_order");
      customFields = (fields ?? []) as typeof customFields;
    }

    // Dados básicos sempre vazios para formulários públicos (nova resposta)
    const basicData = {
      name: null,
      email: null,
      phone: null,
      birth_date: null,
      age: null,
    };

    // Dados do médico associado
    const doctorLogoUrl =
      (data.doctor_logo_url && typeof data.doctor_logo_url === "string")
        ? data.doctor_logo_url
        : null;
    const doctorLogoScale =
      typeof data.doctor_logo_scale === "number" &&
      data.doctor_logo_scale >= 50 &&
      data.doctor_logo_scale <= 200
        ? data.doctor_logo_scale
        : 100;
    const doctorName =
      (data.doctor_name && typeof data.doctor_name === "string" && data.doctor_name.trim())
        ? data.doctor_name.trim()
        : null;

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
            <FormularioPublicoPreenchimento
              templateName={templateName}
              definition={definition}
              initialResponses={responses}
              templateId={templateIdStr}
              basicData={basicData}
              customFields={customFields}
              doctorLogoUrl={doctorLogoUrl}
              doctorLogoScale={doctorLogoScale}
              doctorName={doctorName}
            />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    // Em caso de qualquer erro, retornar 404
    notFound();
  }
}
