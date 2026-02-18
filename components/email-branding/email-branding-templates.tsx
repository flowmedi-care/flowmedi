"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";

export type EmailBrandingTemplate = "professional" | "minimal" | "modern";

interface EmailBrandingTemplatesProps {
  type: "header" | "footer";
  selectedTemplate: EmailBrandingTemplate;
  onTemplateSelect: (template: EmailBrandingTemplate) => void;
  clinicName: string;
  clinicPhone: string | null;
  clinicEmail: string | null;
  clinicAddress: string | null;
  logoUrl: string | null;
  hasPhoneOrEmail?: boolean; // Indica se há telefone ou email cadastrado (para usar variáveis quando salvar)
}

// Templates profissionais inspirados em grandes marcas
function generateHeaderHTML(
  template: EmailBrandingTemplate,
  clinicName: string,
  clinicPhone: string | null,
  clinicEmail: string | null,
  logoUrl: string | null,
  useVariables: boolean = false
): string {
  const name = useVariables ? "{{nome_clinica}}" : (clinicName || "{{nome_clinica}}");
  // Se useVariables=true, só usa variável se houver telefone cadastrado
  const phone = useVariables 
    ? (clinicPhone ? "{{telefone_clinica}}" : null)
    : (clinicPhone || null);
  const email = clinicEmail || "";

  switch (template) {
    case "professional":
      // Inspirado em Apple/Google - limpo e profissional
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <tr>
            <td style="padding: 30px 20px 20px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${name}" style="max-height: 60px; margin-bottom: 15px;" />` : ""}
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827; letter-spacing: -0.5px;">${name}</h1>
              ${(phone || email) ? `
                <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                  ${phone ? `<span style="color: #374151;">${phone}</span>` : ""}
                  ${phone && email ? ` <span style="color: #d1d5db;">•</span> ` : ""}
                  ${email ? `<a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a>` : ""}
                </p>
              ` : ""}
            </td>
          </tr>
        </table>
      `;

    case "minimal":
      // Inspirado em Stripe - minimalista e elegante
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <tr>
            <td style="padding: 40px 20px 30px 20px;">
              ${logoUrl ? `
                <div style="margin-bottom: 20px;">
                  <img src="${logoUrl}" alt="${name}" style="max-height: 50px;" />
                </div>
              ` : ""}
              <div style="border-top: 2px solid #000; padding-top: 20px;">
                <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 500; color: #000; letter-spacing: -0.3px;">${name}</h2>
                ${(phone || email) ? `
                  <p style="margin: 0; font-size: 13px; color: #666; line-height: 1.6;">
                    ${phone || ""}${phone && email ? " • " : ""}${email || ""}
                  </p>
                ` : ""}
              </div>
            </td>
          </tr>
        </table>
      `;

    case "modern":
      // Inspirado em Airbnb/Mailchimp - moderno e colorido
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; border-radius: 8px 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: ${logoUrl ? "left" : "center"};">
                    ${logoUrl ? `
                      <img src="${logoUrl}" alt="${name}" style="max-height: 50px; margin-bottom: 15px; filter: brightness(0) invert(1);" />
                    ` : ""}
                    <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${name}</h1>
                    ${(phone || email) ? `
                      <p style="margin: 10px 0 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.9); line-height: 1.5;">
                        ${phone ? phone : ""}${phone && email ? " • " : ""}${email ? email : ""}
                      </p>
                    ` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

    default:
      return "";
  }
}

function generateFooterHTML(
  template: EmailBrandingTemplate,
  clinicName: string,
  clinicPhone: string | null,
  clinicEmail: string | null,
  clinicAddress: string | null,
  useVariables: boolean = false
): string {
  const name = useVariables ? "{{nome_clinica}}" : (clinicName || "{{nome_clinica}}");
  // Se useVariables=true, só usa variável se houver telefone cadastrado
  const phone = useVariables 
    ? (clinicPhone ? "{{telefone_clinica}}" : null)
    : (clinicPhone || null);
  const email = clinicEmail || "";
  // Se useVariables=true, só usa variável se houver endereço cadastrado
  const address = useVariables 
    ? (clinicAddress ? "{{endereco_clinica}}" : null)
    : (clinicAddress || null);

  switch (template) {
    case "professional":
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <tr>
            <td style="padding: 30px 20px; border-top: 1px solid #e5e7eb; background-color: #f9fafb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #111827;">${name}</p>
                    ${(phone || email || address) ? `
                      <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                        ${phone ? phone : ""}${phone && email ? " • " : ""}${email ? `<a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a>` : ""}
                      </p>
                      ${address ? `<p style="margin: 0 0 12px 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">${address}</p>` : ""}
                    ` : ""}
                    <p style="margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
                      Este é um email automático. Em caso de dúvidas, entre em contato conosco.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

    case "minimal":
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <tr>
            <td style="padding: 40px 20px 30px 20px;">
              <div style="border-top: 1px solid #e5e7eb; padding-top: 30px;">
                <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 500; color: #000;">${name}</p>
                ${(phone || email || address) ? `
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #666; line-height: 1.6;">
                    ${phone || ""}${phone && email ? " • " : ""}${email || ""}
                  </p>
                  ${address ? `<p style="margin: 0 0 20px 0; font-size: 11px; color: #999; line-height: 1.5;">${address}</p>` : ""}
                ` : ""}
                <p style="margin: 0; font-size: 11px; color: #999; line-height: 1.5;">
                  Este é um email automático. Em caso de dúvidas, entre em contato conosco.
                </p>
              </div>
            </td>
          </tr>
        </table>
      `;

    case "modern":
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <tr>
            <td style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 30px 20px; border-radius: 0 0 8px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1f2937;">${name}</p>
                    ${(phone || email || address) ? `
                      <p style="margin: 0 0 8px 0; font-size: 13px; color: #4b5563; line-height: 1.6;">
                        ${phone || ""}${phone && email ? " • " : ""}${email || ""}
                      </p>
                      ${address ? `<p style="margin: 0 0 15px 0; font-size: 12px; color: #6b7280; line-height: 1.5;">${address}</p>` : ""}
                    ` : ""}
                    <p style="margin: 0; font-size: 11px; color: #6b7280; line-height: 1.5;">
                      Este é um email automático. Em caso de dúvidas, entre em contato conosco.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

    default:
      return "";
  }
}

export function EmailBrandingTemplates({
  type,
  selectedTemplate,
  onTemplateSelect,
  clinicName,
  clinicPhone,
  clinicEmail,
  clinicAddress,
  logoUrl,
  hasPhoneOrEmail = false,
}: EmailBrandingTemplatesProps) {
  // Para preview, usa valores reais (useVariables = false)
  const html = type === "header"
    ? generateHeaderHTML(selectedTemplate, clinicName || "", clinicPhone, clinicEmail, logoUrl, false)
    : generateFooterHTML(selectedTemplate, clinicName || "", clinicPhone, clinicEmail, clinicAddress, false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              {type === "header" ? "Cabeçalho" : "Rodapé"} dos Emails
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Escolha um template profissional. As informações da clínica serão preenchidas automaticamente.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seleção de Template */}
        <div>
          <Label className="mb-3 block">Escolha um Template</Label>
          <div className="grid grid-cols-3 gap-3">
            <Button
              type="button"
              variant={selectedTemplate === "professional" ? "default" : "outline"}
              onClick={() => onTemplateSelect("professional")}
              className="h-auto py-4 flex flex-col items-center gap-2"
            >
              <span className="text-sm font-medium">Profissional</span>
              <span className="text-xs text-muted-foreground">Estilo Apple/Google</span>
            </Button>
            <Button
              type="button"
              variant={selectedTemplate === "minimal" ? "default" : "outline"}
              onClick={() => onTemplateSelect("minimal")}
              className="h-auto py-4 flex flex-col items-center gap-2"
            >
              <span className="text-sm font-medium">Minimalista</span>
              <span className="text-xs text-muted-foreground">Estilo Stripe</span>
            </Button>
            <Button
              type="button"
              variant={selectedTemplate === "modern" ? "default" : "outline"}
              onClick={() => onTemplateSelect("modern")}
              className="h-auto py-4 flex flex-col items-center gap-2"
            >
              <span className="text-sm font-medium">Moderno</span>
              <span className="text-xs text-muted-foreground">Estilo Airbnb</span>
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <Label className="mb-2 block">Preview</Label>
          <div className="border rounded-lg p-4 bg-white">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Função para exportar HTML do template selecionado
export function getTemplateHTML(
  type: "header" | "footer",
  template: EmailBrandingTemplate,
  clinicName: string,
  clinicPhone: string | null,
  clinicEmail: string | null,
  clinicAddress: string | null,
  logoUrl: string | null,
  useVariables: boolean = true
): string {
  return type === "header"
    ? generateHeaderHTML(template, clinicName, clinicPhone, clinicEmail, logoUrl, useVariables)
    : generateFooterHTML(template, clinicName, clinicPhone, clinicEmail, clinicAddress, useVariables);
}
