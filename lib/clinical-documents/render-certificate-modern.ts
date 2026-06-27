import type { DocumentRenderContext } from "./types";
import { buildPlaceholderMap } from "./placeholders";
import {
  buildLayoutCss,
  DEFAULT_CLINICAL_PDF_LAYOUT,
  getLayoutTheme,
  type ClinicalPdfLayoutId,
} from "./pdf-layouts";

function logoImg(url: string | null, scale: number | null, alt: string): string {
  if (!url) return "";
  const pct = scale && scale > 0 ? scale : 100;
  const maxH = Math.round(52 * (pct / 100));
  return `<img src="${url}" alt="${alt}" style="max-height:${maxH}px;max-width:180px;object-fit:contain" />`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type RenderCertificateInput = {
  ctx: DocumentRenderContext;
  certificateBody: string;
  certificateDays?: number;
  certificateCid?: string;
  layoutId?: ClinicalPdfLayoutId | string | null;
};

export function renderCertificateModernHtml(input: RenderCertificateInput): string {
  const layoutId = (input.layoutId ?? DEFAULT_CLINICAL_PDF_LAYOUT) as ClinicalPdfLayoutId;
  const theme = getLayoutTheme(layoutId);
  const map = buildPlaceholderMap(input.ctx);

  const clinicLogo = logoImg(
    input.ctx.clinic.logo_url,
    input.ctx.clinic.logo_scale,
    input.ctx.clinic.name
  );

  const crmLine = map["{{crm_medico}}"];
  const birthDisplay = map["{{data_nascimento}}"];
  const emissionDate = map["{{data_emissao}}"];
  const bodyHtml = escapeHtml(input.certificateBody.trim()).replace(/\n/g, "<br/>");

  const daysLine =
    input.certificateDays && input.certificateDays > 0
      ? `<p class="content-line-details"><strong>Afastamento:</strong> ${input.certificateDays} dia(s)</p>`
      : "";

  const cidLine = input.certificateCid?.trim()
    ? `<p class="content-line-details"><strong>CID:</strong> ${escapeHtml(input.certificateCid.trim())}</p>`
    : "";

  const contactParts = [
    input.ctx.clinic.phone ? escapeHtml(input.ctx.clinic.phone) : "",
    input.ctx.clinic.email ? escapeHtml(input.ctx.clinic.email) : "",
  ].filter(Boolean);

  const footerContact =
    theme.showFooterContact && contactParts.length
      ? `<p class="footer-contact">${contactParts.join(" · ")}</p>`
      : "";

  const titleAlign =
    theme.headerAlign === "center" ? ' style="text-align:center;width:100%"' : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Atestado médico</title>
  <style>${buildLayoutCss(theme)}</style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="header-left">
        ${clinicLogo}
        <p class="clinic-name">${escapeHtml(input.ctx.clinic.name)}</p>
      </div>
      <div class="doctor-block">
        <p class="doctor-name">${escapeHtml(map["{{nome_medico}}"])}</p>
        <p class="doctor-crm">${escapeHtml(crmLine)}</p>
      </div>
    </header>

    <div class="title-badge"${titleAlign}>Atestado médico</div>

    <div class="patient-simple">
      <p><strong>Paciente:</strong> ${escapeHtml(map["{{nome_paciente}}"])}</p>
      <p><strong>Data de nascimento:</strong> ${birthDisplay}</p>
    </div>

    <div class="content-list">
      <div class="content-line">
        <div class="content-line-details" style="padding-left:0;font-size:11pt;line-height:1.6">
          ${bodyHtml || "<em>Texto do atestado não informado.</em>"}
        </div>
        ${daysLine}
        ${cidLine}
      </div>
    </div>

    <div class="sign-footer">
      <div class="sign-block">
        <p class="sign-date">${escapeHtml(emissionDate)}</p>
        <div class="sign-area"></div>
        <p class="sign-label">Assinatura e carimbo do médico</p>
      </div>
    </div>

    ${footerContact}
  </div>
</body>
</html>`;
}
