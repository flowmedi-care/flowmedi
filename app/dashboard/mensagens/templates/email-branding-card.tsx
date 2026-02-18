"use client";

import { useState, useEffect } from "react";
import { getClinicEmailBranding, updateClinicEmailBranding } from "../actions";
import { EmailBrandingEditor, EmailBrandingTemplate, EmailBrandingColors } from "@/components/email-branding/email-branding-editor";

export function EmailBrandingCard() {
  const [loading, setLoading] = useState(true);
  const [brandingData, setBrandingData] = useState<{
    email_header: string | null;
    email_footer: string | null;
    email_header_template: string | null;
    email_footer_template: string | null;
    email_branding_colors: Record<string, unknown> | null;
    logo_url: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null>(null);

  useEffect(() => {
    getClinicEmailBranding().then((res) => {
      setLoading(false);
      if (res.data) {
        setBrandingData(res.data);
      }
    });
  }, []);

  if (loading || !brandingData) {
    return (
      <div className="text-sm text-muted-foreground p-4">Carregando...</div>
    );
  }

  const colors = (brandingData.email_branding_colors || {
    primary: "#007bff",
    secondary: "#6c757d",
    text: "#333333",
    background: "#ffffff",
  }) as EmailBrandingColors;

  const [headerHtml, setHeaderHtml] = useState<string | null>(brandingData.email_header);
  const [footerHtml, setFooterHtml] = useState<string | null>(brandingData.email_footer);
  const [headerTemplate, setHeaderTemplate] = useState<EmailBrandingTemplate>((brandingData.email_header_template as EmailBrandingTemplate) || "minimal");
  const [footerTemplate, setFooterTemplate] = useState<EmailBrandingTemplate>((brandingData.email_footer_template as EmailBrandingTemplate) || "minimal");
  const [currentColors, setCurrentColors] = useState<EmailBrandingColors>(colors);

  const handleHeaderSave = async (html: string, template: EmailBrandingTemplate, newColors: EmailBrandingColors) => {
    setHeaderHtml(html);
    setHeaderTemplate(template);
    setCurrentColors(newColors);
    await updateClinicEmailBranding(html, footerHtml, template, footerTemplate, newColors);
  };

  const handleFooterSave = async (html: string, template: EmailBrandingTemplate, newColors: EmailBrandingColors) => {
    setFooterHtml(html);
    setFooterTemplate(template);
    setCurrentColors(newColors);
    await updateClinicEmailBranding(headerHtml, html, headerTemplate, template, newColors);
  };

  return (
    <div className="space-y-6">
      <EmailBrandingEditor
        type="header"
        initialHtml={headerHtml}
        initialTemplate={headerTemplate}
        initialColors={currentColors}
        logoUrl={brandingData.logo_url}
        clinicName={brandingData.name || ""}
        clinicPhone={brandingData.phone}
        clinicEmail={brandingData.email}
        onSave={handleHeaderSave}
      />

      <EmailBrandingEditor
        type="footer"
        initialHtml={footerHtml}
        initialTemplate={footerTemplate}
        initialColors={currentColors}
        logoUrl={null}
        clinicName={brandingData.name || ""}
        clinicPhone={brandingData.phone}
        clinicEmail={brandingData.email}
        onSave={handleFooterSave}
      />
    </div>
  );
}
