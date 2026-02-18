"use client";

import { useState, useEffect } from "react";
import { getClinicEmailBranding, updateClinicEmailBranding } from "../actions";
import { EmailBrandingTemplates, EmailBrandingTemplate, getTemplateHTML } from "@/components/email-branding/email-branding-templates";
import { Button } from "@/components/ui/button";

export function EmailBrandingCard() {
  const [loading, setLoading] = useState(true);
  const [brandingData, setBrandingData] = useState<{
    email_header: string | null;
    email_footer: string | null;
    email_header_template: string | null;
    email_footer_template: string | null;
    logo_url: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null>(null);

  const [headerTemplate, setHeaderTemplate] = useState<EmailBrandingTemplate>("professional");
  const [footerTemplate, setFooterTemplate] = useState<EmailBrandingTemplate>("professional");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getClinicEmailBranding().then((res) => {
      setLoading(false);
      if (res.data) {
        setBrandingData(res.data);
        setHeaderTemplate((res.data.email_header_template as EmailBrandingTemplate) || "professional");
        setFooterTemplate((res.data.email_footer_template as EmailBrandingTemplate) || "professional");
      }
    });
  }, []);

  const handleSave = async () => {
    if (!brandingData) return;
    
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Gerar HTML com variáveis (serão substituídas na hora do envio)
    // useVariables = true para salvar com variáveis
    // Se template for "none", salva null
    const headerHtml = headerTemplate === "none" 
      ? null
      : getTemplateHTML(
          "header",
          headerTemplate,
          brandingData.name || "",
          brandingData.phone,
          brandingData.email || "",
          brandingData.address || null,
          brandingData.logo_url,
          true // usar variáveis
        );

    const footerHtml = footerTemplate === "none"
      ? null
      : getTemplateHTML(
          "footer",
          footerTemplate,
          brandingData.name || "",
          brandingData.phone,
          brandingData.email || "",
          brandingData.address || null,
          brandingData.logo_url,
          true // usar variáveis
        );

    const result = await updateClinicEmailBranding(
      headerHtml,
      footerHtml,
      headerTemplate,
      footerTemplate
    );

    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  if (loading || !brandingData) {
    return (
      <div className="text-sm text-muted-foreground p-4">Carregando...</div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md text-sm">
          Templates salvos com sucesso!
        </div>
      )}

      <EmailBrandingTemplates
        type="header"
        selectedTemplate={headerTemplate}
        onTemplateSelect={setHeaderTemplate}
        clinicName={brandingData.name || ""}
        clinicPhone={brandingData.phone}
        clinicEmail={brandingData.email}
        clinicAddress={brandingData.address}
        logoUrl={brandingData.logo_url}
        hasPhoneOrEmail={!!(brandingData.phone || brandingData.email)}
      />

      <EmailBrandingTemplates
        type="footer"
        selectedTemplate={footerTemplate}
        onTemplateSelect={setFooterTemplate}
        clinicName={brandingData.name || ""}
        clinicPhone={brandingData.phone}
        clinicEmail={brandingData.email}
        clinicAddress={brandingData.address}
        logoUrl={null}
        hasPhoneOrEmail={!!(brandingData.phone || brandingData.email)}
      />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Templates"}
        </Button>
      </div>
    </div>
  );
}
