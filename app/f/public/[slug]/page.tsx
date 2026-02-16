import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { FormularioPublicoPreenchimento } from "../formulario-publico-preenchimento";
import { LogoImage } from "@/components/logo-image";

export default async function FormularioPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    const { slug } = await params;

    if (!slug || typeof slug !== "string") {
      notFound();
    }

    const supabase = await createClient();
    
    // Buscar todos os templates públicos e encontrar o que corresponde ao slug
    const { data: allTemplates, error: fetchError } = await supabase
      .from("form_templates")
      .select("id, name")
      .eq("is_public", true);
    
    if (fetchError || !allTemplates) {
      notFound();
    }
    
    // Função para gerar slug a partir de nome (mesma lógica do TypeScript)
    const slugify = (text: string): string => {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 100);
    };
    
    // Encontrar template cujo slug do nome corresponde ao slug fornecido
    const matchingTemplate = allTemplates.find((t) => {
      const templateSlug = slugify(t.name);
      return templateSlug === slug;
    });
    
    if (!matchingTemplate) {
      notFound();
    }
    
    // Usar função RPC para buscar dados completos
    const { data, error } = await supabase.rpc("get_public_form_template", {
      p_template_id: matchingTemplate.id,
    });

    if (error || !data || !data.found) {
      notFound();
    }

    return renderForm(data, matchingTemplate.id);
  } catch (error) {
    notFound();
  }
}

async function renderForm(data: any, templateId: string) {
  const supabase = await createClient();
  
  // Validar e sanitizar dados
  const definition = Array.isArray(data.definition) ? data.definition : [];
  const responses: Record<string, unknown> = {}; // Sempre vazio para nova resposta

  const templateName =
    (data.template_name && typeof data.template_name === "string" && data.template_name.trim())
      ? data.template_name.trim()
      : "Formulário";

  const templateIdStr = String(data.template_id || templateId);

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
}
