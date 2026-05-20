import type { ClinicalDocumentType, DocumentRenderContext, StructuredContent } from "./types";
import {
  applyPlaceholders,
  bodyTextToHtmlParagraphs,
  buildPlaceholderMap,
  structuredContentToHtml,
} from "./placeholders";

export type RenderDocumentInput = {
  type: ClinicalDocumentType;
  title: string | null;
  bodyText: string;
  structuredContent: StructuredContent;
  ctx: DocumentRenderContext;
  manualSignature?: boolean;
};

function logoImg(url: string | null, scale: number | null, alt: string): string {
  if (!url) return "";
  const pct = scale && scale > 0 ? scale : 100;
  const maxH = Math.round(48 * (pct / 100));
  return `<img src="${url}" alt="${alt}" style="max-height:${maxH}px;max-width:180px;object-fit:contain" />`;
}

export function renderClinicalDocumentHtml(input: RenderDocumentInput): string {
  const map = buildPlaceholderMap(input.ctx);
  const bodyResolved = applyPlaceholders(input.bodyText, map);
  const bodyHtml = bodyTextToHtmlParagraphs(bodyResolved);
  const structuredHtml = structuredContentToHtml(input.type, input.structuredContent);

  const docTitle =
    input.type === "prescription"
      ? input.title?.trim() || "RECEITUÁRIO MÉDICO"
      : input.title?.trim() || "PEDIDO DE EXAME";

  const clinicLogo = logoImg(
    input.ctx.clinic.logo_url,
    input.ctx.clinic.logo_scale,
    input.ctx.clinic.name
  );
  const doctorStamp = logoImg(
    input.ctx.doctor.logo_url,
    input.ctx.doctor.logo_scale,
    "Carimbo do médico"
  );

  const crmLine = map["{{crm_medico}}"];

  const manualBlock = input.manualSignature !== false
    ? `
    <div class="manual-signature-area">
      <div class="manual-signature-line"></div>
      <p class="manual-signature-label">Assinatura e carimbo do médico</p>
    </div>`
    : `
    <p class="digital-badge">Documento assinado digitalmente (ICP-Brasil)</p>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.45;
      color: #111;
      margin: 0;
      padding: 0;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
      min-height: 277mm;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      border-bottom: 2px solid #1e3a5f;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-info { flex: 1; }
    .clinic-name { font-size: 14pt; font-weight: bold; margin: 0 0 4px; color: #1e3a5f; }
    .clinic-meta { font-size: 9pt; color: #444; margin: 0; }
    .doc-title {
      text-align: center;
      font-size: 13pt;
      font-weight: bold;
      letter-spacing: 0.05em;
      margin: 8px 0 16px;
      text-transform: uppercase;
    }
    .patient-block {
      background: #f5f7fa;
      border: 1px solid #dde3ea;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 16px;
      font-size: 10.5pt;
    }
    .patient-block strong { display: inline-block; min-width: 120px; }
    .body-content p { margin: 0 0 10px; }
    .structured-list { margin: 12px 0; padding-left: 20px; }
    .structured-list li { margin-bottom: 8px; }
    .footer {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid #ccc;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }
    .footer-doctor { text-align: right; font-size: 10pt; }
    .footer-doctor p { margin: 2px 0; }
    .manual-signature-area {
      margin-top: 24px;
      min-height: 45mm;
      padding-top: 8px;
    }
    .manual-signature-line {
      border-bottom: 1px solid #333;
      width: 70%;
      margin-bottom: 6px;
    }
    .manual-signature-label { font-size: 9pt; color: #555; margin: 0; }
    .digital-badge { font-size: 9pt; color: #1e3a5f; font-style: italic; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 12mm; min-height: auto; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      ${clinicLogo ? `<div class="header-logo">${clinicLogo}</div>` : ""}
      <div class="header-info">
        <p class="clinic-name">${input.ctx.clinic.name}</p>
        ${input.ctx.clinic.address ? `<p class="clinic-meta">${input.ctx.clinic.address}</p>` : ""}
        ${input.ctx.clinic.phone ? `<p class="clinic-meta">Tel: ${input.ctx.clinic.phone}</p>` : ""}
        ${input.ctx.clinic.email ? `<p class="clinic-meta">${input.ctx.clinic.email}</p>` : ""}
      </div>
    </header>

    <h1 class="doc-title">${docTitle}</h1>

    <section class="patient-block">
      <p><strong>Paciente:</strong> ${map["{{nome_paciente}}"]}</p>
      <p><strong>CPF:</strong> ${map["{{cpf_paciente}}"]} &nbsp;|&nbsp; <strong>Nasc.:</strong> ${map["{{data_nascimento}}"]} (${map["{{idade}}"]} anos)</p>
      <p><strong>Telefone:</strong> ${map["{{telefone_paciente}}"]}</p>
      <p><strong>Data de emissão:</strong> ${map["{{data_emissao}}"]}</p>
    </section>

    <section class="body-content">
      ${bodyHtml}
      ${structuredHtml}
    </section>

    <footer class="footer">
      <div>${doctorStamp}</div>
      <div class="footer-doctor">
        <p><strong>${map["{{nome_medico}}"]}</strong></p>
        <p>${crmLine}</p>
      </div>
    </footer>

    ${manualBlock}
  </div>
</body>
</html>`;
}

export function emptyStructuredContent(type: ClinicalDocumentType): StructuredContent {
  return type === "prescription"
    ? { medications: [{ name: "", dosage: "", quantity: "", instructions: "" }] }
    : { exams: [{ name: "", notes: "" }] };
}
