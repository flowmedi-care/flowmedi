"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";

export type EmailBrandingTemplate = "professional" | "minimal" | "modern" | "none";

interface EmailBrandingTemplatesProps {
  type: "header" | "footer";
  selectedTemplate: EmailBrandingTemplate;
  onTemplateSelect: (template: EmailBrandingTemplate) => void;
  clinicName: string;
  clinicPhone: string | null;
  clinicEmail: string | null;
  clinicAddress: string | null;
  logoUrl: string | null;
  hasPhoneOrEmail?: boolean;
  /** Cor do cabeçalho moderno (só usado quando type="header" e template="modern") */
  modernHeaderColor?: string | null;
  onModernHeaderColorChange?: (color: string) => void;
  /** Redes sociais (só usados quando type="footer") */
  clinicWhatsappUrl?: string | null;
  clinicFacebookUrl?: string | null;
  clinicInstagramUrl?: string | null;
}

/** Escurece um hex para usar como fim do gradiente */
function darkenHex(hex: string, factor: number): string {
  const match = hex.replace(/^#/, "").match(/.{2}/g);
  if (!match) return hex;
  const r = Math.max(0, Math.floor(parseInt(match[0], 16) * factor));
  const g = Math.max(0, Math.floor(parseInt(match[1], 16) * factor));
  const b = Math.max(0, Math.floor(parseInt(match[2], 16) * factor));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Templates profissionais inspirados em grandes marcas
function generateHeaderHTML(
  template: EmailBrandingTemplate,
  clinicName: string,
  clinicPhone: string | null,
  clinicEmail: string | null,
  logoUrl: string | null,
  useVariables: boolean = false,
  modernHeaderColor?: string | null
): string {
  const name = useVariables ? "{{nome_clinica}}" : (clinicName || "{{nome_clinica}}");
  const phone = useVariables 
    ? (clinicPhone ? "{{telefone_clinica}}" : null)
    : (clinicPhone || null);
  const email = clinicEmail || "";

  switch (template) {
    case "professional":
      // Inspirado em Apple/Google - limpo e profissional (apenas logo + nome)
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <tr>
            <td style="padding: 30px 20px 32px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${name}" style="max-height: 60px; margin-bottom: 15px;" />` : ""}
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827; letter-spacing: -0.5px;">${name}</h1>
            </td>
          </tr>
        </table>
      `;

    case "minimal":
      // Inspirado em Stripe - minimalista e elegante (apenas logo + nome)
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <tr>
            <td style="padding: 40px 20px 40px 20px;">
              ${logoUrl ? `
                <div style="margin-bottom: 20px;">
                  <img src="${logoUrl}" alt="${name}" style="max-height: 50px;" />
                </div>
              ` : ""}
              <div style="border-top: 2px solid #000; padding-top: 20px;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 500; color: #000; letter-spacing: -0.3px;">${name}</h2>
              </div>
            </td>
          </tr>
        </table>
      `;

    case "modern": {
      const startColor = (modernHeaderColor && /^#[0-9A-Fa-f]{6}$/.test(modernHeaderColor)) ? modernHeaderColor : "#667eea";
      const endColor = darkenHex(startColor, 0.7);
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <tr>
            <td style="background: linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%); padding: 30px 20px 32px 20px; border-radius: 8px 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    ${logoUrl ? `
                      <div style="margin-bottom: 15px;">
                        <img src="${logoUrl}" alt="${name}" style="max-height: 50px; background-color: rgba(255, 255, 255, 0.95); padding: 8px; border-radius: 8px; display: inline-block;" />
                      </div>
                    ` : ""}
                    <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${name}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
    }

    case "none":
      return "";

    default:
      return "";
  }
}

/** Gera a linha de redes sociais para o rodapé (só inclui links que existem) */
function getSocialLinksRow(
  whatsappUrl: string | null,
  facebookUrl: string | null,
  instagramUrl: string | null,
  useVariables: boolean,
  linkColor: string
): string {
  const hasAny = !!(whatsappUrl || facebookUrl || instagramUrl);
  if (!hasAny) return "";
  const links: string[] = [];
  if (whatsappUrl) {
    const href = useVariables ? "{{link_whatsapp_clinica}}" : whatsappUrl;
    links.push(`<a href="${href}" style="color: ${linkColor}; text-decoration: none;">WhatsApp</a>`);
  }
  if (facebookUrl) {
    const href = useVariables ? "{{link_facebook_clinica}}" : facebookUrl;
    links.push(`<a href="${href}" style="color: ${linkColor}; text-decoration: none;">Facebook</a>`);
  }
  if (instagramUrl) {
    const href = useVariables ? "{{link_instagram_clinica}}" : instagramUrl;
    links.push(`<a href="${href}" style="color: ${linkColor}; text-decoration: none;">Instagram</a>`);
  }
  if (links.length === 0) return "";
  return `<p style="margin: 0 0 12px 0; font-size: 12px; line-height: 1.5;">${links.join(" &nbsp;|&nbsp; ")}</p>`;
}

function generateFooterHTML(
  template: EmailBrandingTemplate,
  clinicName: string,
  clinicPhone: string | null,
  clinicEmail: string | null,
  clinicAddress: string | null,
  useVariables: boolean = false,
  clinicWhatsappUrl?: string | null,
  clinicFacebookUrl?: string | null,
  clinicInstagramUrl?: string | null
): string {
  const name = useVariables ? "{{nome_clinica}}" : (clinicName || "{{nome_clinica}}");
  const phone = useVariables 
    ? (clinicPhone ? "{{telefone_clinica}}" : null)
    : (clinicPhone || null);
  const email = clinicEmail || "";
  const address = useVariables 
    ? (clinicAddress ? "{{endereco_clinica}}" : null)
    : (clinicAddress || null);
  const socialRow = getSocialLinksRow(
    clinicWhatsappUrl ?? null,
    clinicFacebookUrl ?? null,
    clinicInstagramUrl ?? null,
    useVariables,
    "#2563eb"
  );
  const socialRowGray = getSocialLinksRow(
    clinicWhatsappUrl ?? null,
    clinicFacebookUrl ?? null,
    clinicInstagramUrl ?? null,
    useVariables,
    "#6b7280"
  );
  const socialRowDark = getSocialLinksRow(
    clinicWhatsappUrl ?? null,
    clinicFacebookUrl ?? null,
    clinicInstagramUrl ?? null,
    useVariables,
    "#4b5563"
  );

  switch (template) {
    case "professional":
      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <tr>
            <td style="padding: 32px 20px 30px 20px; border-top: 1px solid #e5e7eb; background-color: #f9fafb;">
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
                    ${socialRow}
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
              <div style="border-top: 1px solid #e5e7eb; padding-top: 40px;">
                <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 500; color: #000;">${name}</p>
                ${(phone || email || address) ? `
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #666; line-height: 1.6;">
                    ${phone || ""}${phone && email ? " • " : ""}${email || ""}
                  </p>
                  ${address ? `<p style="margin: 0 0 20px 0; font-size: 11px; color: #999; line-height: 1.5;">${address}</p>` : ""}
                ` : ""}
                ${socialRowGray}
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
            <td style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 32px 20px 30px 20px; border-radius: 0 0 8px 8px;">
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
                    ${socialRowDark}
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
  modernHeaderColor = null,
  onModernHeaderColorChange,
  clinicWhatsappUrl = null,
  clinicFacebookUrl = null,
  clinicInstagramUrl = null,
}: EmailBrandingTemplatesProps) {
  const html = type === "header"
    ? generateHeaderHTML(selectedTemplate, clinicName || "", clinicPhone, clinicEmail, logoUrl, false, modernHeaderColor)
    : generateFooterHTML(selectedTemplate, clinicName || "", clinicPhone, clinicEmail, clinicAddress, false, clinicWhatsappUrl, clinicFacebookUrl, clinicInstagramUrl);

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
          <div className="grid grid-cols-4 gap-3">
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
            <Button
              type="button"
              variant={selectedTemplate === "none" ? "default" : "outline"}
              onClick={() => onTemplateSelect("none")}
              className="h-auto py-4 flex flex-col items-center gap-2"
            >
              <span className="text-sm font-medium">Nenhum</span>
              <span className="text-xs text-muted-foreground">Sem cabeçalho/rodapé</span>
            </Button>
          </div>
        </div>

        {type === "header" && selectedTemplate === "modern" && onModernHeaderColorChange && (
          <div className="flex items-center gap-3">
            <Label className="shrink-0">Cor do cabeçalho</Label>
            <input
              type="color"
              value={modernHeaderColor || "#667eea"}
              onChange={(e) => onModernHeaderColorChange(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-input bg-background"
            />
            <span className="text-sm text-muted-foreground">
              {modernHeaderColor || "#667eea"}
            </span>
          </div>
        )}

        {/* Preview */}
        <div>
          <Label className="mb-2 block">Preview</Label>
          {selectedTemplate === "none" ? (
            <div className="border rounded-lg p-4 bg-muted/50 text-center text-sm text-muted-foreground">
              Nenhum template selecionado. O email será enviado sem cabeçalho/rodapé.
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-white">
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          )}
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
  useVariables: boolean = true,
  modernHeaderColor?: string | null,
  clinicWhatsappUrl?: string | null,
  clinicFacebookUrl?: string | null,
  clinicInstagramUrl?: string | null
): string {
  return type === "header"
    ? generateHeaderHTML(template, clinicName, clinicPhone, clinicEmail, logoUrl, useVariables, modernHeaderColor)
    : generateFooterHTML(template, clinicName, clinicPhone, clinicEmail, clinicAddress, useVariables, clinicWhatsappUrl, clinicFacebookUrl, clinicInstagramUrl);
}
