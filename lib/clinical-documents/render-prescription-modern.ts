import type { DocumentRenderContext, MedicationItem } from "./types";
import { buildPlaceholderMap } from "./placeholders";

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

export type RenderPrescriptionInput = {
  ctx: DocumentRenderContext;
  medications: MedicationItem[];
  bodyText?: string;
  manualSignature?: boolean;
};

export function renderPrescriptionModernHtml(input: RenderPrescriptionInput): string {
  const map = buildPlaceholderMap(input.ctx);
  const meds = input.medications.filter((m) => m.name.trim());

  const medRows = meds
    .map((m, i) => {
      const meta = [m.dosage, m.quantity].filter(Boolean).join(" • ");
      return `<div class="med-card">
        <div class="med-num">${i + 1}</div>
        <div class="med-body">
          <p class="med-name">${escapeHtml(m.name)}</p>
          ${meta ? `<p class="med-meta">${escapeHtml(meta)}</p>` : ""}
          ${m.instructions ? `<p class="med-instructions">${escapeHtml(m.instructions)}</p>` : ""}
        </div>
      </div>`;
    })
    .join("");

  const clinicLogo = logoImg(
    input.ctx.clinic.logo_url,
    input.ctx.clinic.logo_scale,
    input.ctx.clinic.name
  );
  const doctorStamp = logoImg(
    input.ctx.doctor.logo_url,
    input.ctx.doctor.logo_scale,
    "Carimbo"
  );

  const extraText = input.bodyText?.trim()
    ? `<div class="extra-text">${escapeHtml(input.bodyText).replace(/\n/g, "<br/>")}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Receituário médico</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      font-size: 11pt;
      color: #1a2e35;
      margin: 0;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 14mm;
      min-height: 277mm;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #0d6b7d;
      margin-bottom: 16px;
    }
    .clinic-name { font-size: 13pt; font-weight: 700; color: #0d6b7d; margin: 0; }
    .clinic-meta { font-size: 8.5pt; color: #5a7a85; margin: 2px 0 0; }
    .badge {
      display: inline-block;
      background: #0d6b7d;
      color: #fff;
      font-size: 9pt;
      font-weight: 600;
      padding: 4px 14px;
      border-radius: 16px;
      margin-bottom: 14px;
    }
    .patient-card {
      background: #f0f7f9;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 18px;
      font-size: 10pt;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
    }
    .patient-card span { color: #5a7a85; font-size: 8pt; display: block; }
    .med-list { display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .med-card {
      display: flex;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid #d0e4ea;
      border-radius: 8px;
      background: #fafcfd;
    }
    .med-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #0d6b7d;
      color: #fff;
      font-weight: 700;
      font-size: 11pt;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .med-name { font-weight: 600; font-size: 11pt; margin: 0 0 4px; color: #0d3d4a; }
    .med-meta { font-size: 9.5pt; color: #5a7a85; margin: 0 0 4px; }
    .med-instructions { font-size: 10pt; margin: 0; line-height: 1.4; }
    .extra-text { margin-top: 14px; font-size: 10pt; color: #444; }
    .footer {
      margin-top: auto;
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid #d0e4ea;
    }
    .footer-doctor { text-align: right; font-size: 10pt; }
    .sign-area {
      margin-top: 20px;
      min-height: 40mm;
      border-top: 1px dashed #8eb4c0;
      padding-top: 8px;
    }
    .sign-label { font-size: 8pt; color: #5a7a85; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      ${clinicLogo ? `<div>${clinicLogo}</div>` : ""}
      <div style="flex:1">
        <p class="clinic-name">${escapeHtml(input.ctx.clinic.name)}</p>
        ${input.ctx.clinic.phone ? `<p class="clinic-meta">${escapeHtml(input.ctx.clinic.phone)}</p>` : ""}
        ${input.ctx.clinic.address ? `<p class="clinic-meta">${escapeHtml(input.ctx.clinic.address)}</p>` : ""}
      </div>
    </header>

    <div class="badge">Receituário médico</div>

    <div class="patient-card">
      <div><span>Paciente</span><strong>${escapeHtml(map["{{nome_paciente}}"])}</strong></div>
      <div><span>Data</span><strong>${map["{{data_emissao}}"]}</strong></div>
      <div><span>CPF</span><strong>${map["{{cpf_paciente}}"]}</strong></div>
      <div><span>Nascimento</span><strong>${map["{{data_nascimento}}"]} (${map["{{idade}}"]} anos)</strong></div>
    </div>

    <div class="med-list">${medRows || "<p style='color:#888'>Nenhum medicamento informado.</p>"}</div>
    ${extraText}

    <footer class="footer">
      <div>${doctorStamp}</div>
      <div class="footer-doctor">
        <p><strong>${escapeHtml(map["{{nome_medico}}"])}</strong></p>
        <p>${escapeHtml(map["{{crm_medico}}"])}</p>
      </div>
    </footer>

    <div class="sign-area">
      <p class="sign-label">Assinatura e carimbo do médico</p>
    </div>
  </div>
</body>
</html>`;
}
