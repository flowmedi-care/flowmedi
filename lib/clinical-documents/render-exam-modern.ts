import type { DocumentRenderContext, ExamCatalogItem } from "./types";
import { buildPlaceholderMap } from "./placeholders";

function logoImg(url: string | null, scale: number | null, alt: string): string {
  if (!url) return "";
  const pct = scale && scale > 0 ? scale : 100;
  const maxH = Math.round(56 * (pct / 100));
  return `<img src="${url}" alt="${alt}" style="max-height:${maxH}px;max-width:200px;object-fit:contain" />`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function groupByCategory(items: ExamCatalogItem[]): Map<string, ExamCatalogItem[]> {
  const map = new Map<string, ExamCatalogItem[]>();
  for (const item of items) {
    const cat = item.category?.trim() || "Geral";
    const list = map.get(cat) ?? [];
    list.push(item);
    map.set(cat, list);
  }
  return map;
}

/** Distribui categorias em até 3 colunas de forma equilibrada */
function splitCategoriesIntoColumns(
  categories: [string, ExamCatalogItem[]][]
): [string, ExamCatalogItem[]][][] {
  const cols: [string, ExamCatalogItem[]][][] = [[], [], []];
  categories.forEach((entry, i) => {
    cols[i % 3].push(entry);
  });
  return cols;
}

function renderCategoryBlock(
  category: string,
  items: ExamCatalogItem[],
  selectedIds: Set<string>
): string {
  const rows = items
    .map((item) => {
      const checked = selectedIds.has(item.id);
      return `<label class="exam-item">
        <span class="exam-checkbox${checked ? " checked" : ""}"></span>
        <span class="exam-name">${escapeHtml(item.name)}</span>
      </label>`;
    })
    .join("");
  return `<div class="exam-category">
    <h3 class="exam-category-title">${escapeHtml(category)}</h3>
    <div class="exam-items">${rows}</div>
  </div>`;
}

export type RenderExamRequestInput = {
  ctx: DocumentRenderContext;
  catalog: ExamCatalogItem[];
  selectedExamIds: string[];
  examNotes?: string;
  manualSignature?: boolean;
};

export function renderExamRequestModernHtml(input: RenderExamRequestInput): string {
  const map = buildPlaceholderMap(input.ctx);
  const selected = new Set(input.selectedExamIds);
  const activeCatalog = input.catalog.filter((c) => c.is_active);
  const grouped = groupByCategory(activeCatalog);
  const categories = Array.from(grouped.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR")
  );
  const columns = splitCategoriesIntoColumns(categories);

  const columnHtml = columns
    .map((col) => {
      const blocks = col.map(([cat, items]) => renderCategoryBlock(cat, items, selected)).join("");
      return `<div class="exam-column">${blocks}</div>`;
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

  const crmLine = map["{{crm_medico}}"];
  const cityLine = input.ctx.clinic.address?.split(",")[0]?.trim() || "Local";
  const [d, m, y] = map["{{data_emissao}}"].split("/");

  const notesBlock = input.examNotes?.trim()
    ? `<div class="exam-notes"><strong>Observações:</strong> ${escapeHtml(input.examNotes)}</div>`
    : "";

  const contactParts = [
    input.ctx.clinic.phone ? `📞 ${escapeHtml(input.ctx.clinic.phone)}` : "",
    input.ctx.clinic.email ? `✉ ${escapeHtml(input.ctx.clinic.email)}` : "",
    input.ctx.clinic.address ? `📍 ${escapeHtml(input.ctx.clinic.address)}` : "",
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Solicitação de exames</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 9pt;
      color: #1a3d4a;
      background: #fff;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 12mm 14mm;
      min-height: 277mm;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .watermark {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.04;
      pointer-events: none;
      z-index: 0;
    }
    .content { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; }
    .header {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: start;
      gap: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #b8d4dc;
      margin-bottom: 12px;
    }
    .header-center { text-align: center; }
    .doctor-name {
      font-family: Georgia, serif;
      font-size: 14pt;
      font-weight: 600;
      color: #0d5c6d;
      margin-bottom: 2px;
    }
    .doctor-crm { font-size: 8.5pt; color: #5a7a85; }
    .qr-placeholder {
      width: 52px;
      height: 52px;
      border: 1px solid #c5dde4;
      border-radius: 4px;
      background: #f0f7f9;
      justify-self: end;
    }
    .patient-row {
      margin: 10px 0 14px;
      font-size: 10pt;
    }
    .patient-row strong { color: #0d5c6d; }
    .patient-line {
      border-bottom: 1px solid #8eb4c0;
      display: inline-block;
      min-width: 280px;
      margin-left: 8px;
      padding-bottom: 2px;
    }
    .badge-title {
      display: inline-block;
      background: linear-gradient(135deg, #0d6b7d, #1496ad);
      color: #fff;
      font-size: 9pt;
      font-weight: 600;
      padding: 5px 16px;
      border-radius: 20px;
      margin-bottom: 14px;
      letter-spacing: 0.02em;
    }
    .exam-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 14px 18px;
      flex: 1;
    }
    .exam-column { display: flex; flex-direction: column; gap: 12px; }
    .exam-category-title {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0d5c6d;
      margin-bottom: 6px;
      padding-bottom: 3px;
      border-bottom: 1px solid #c5dde4;
    }
    .exam-items { display: flex; flex-direction: column; gap: 4px; }
    .exam-item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 8pt;
      line-height: 1.3;
      cursor: default;
    }
    .exam-checkbox {
      flex-shrink: 0;
      width: 11px;
      height: 11px;
      border: 1.5px solid #5a9aaa;
      border-radius: 50%;
      margin-top: 1px;
      background: #fff;
    }
    .exam-checkbox.checked {
      background: #0d6b7d;
      border-color: #0d6b7d;
      box-shadow: inset 0 0 0 2px #fff;
    }
    .exam-name { color: #2a4a55; }
    .exam-notes {
      margin-top: 12px;
      padding: 8px 10px;
      background: #f0f7f9;
      border-radius: 6px;
      font-size: 8.5pt;
    }
    .sign-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 20px;
      padding-top: 12px;
    }
    .sign-box label {
      font-size: 8pt;
      color: #5a7a85;
      display: block;
      margin-bottom: 4px;
    }
    .sign-field {
      border: 1px solid #b8d4dc;
      border-radius: 4px;
      min-height: 36px;
      background: #fafcfd;
      padding: 6px 10px;
      font-size: 10pt;
    }
    .sign-stamp-area {
      min-height: 50px;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      gap: 8px;
    }
    .footer-contact {
      margin-top: auto;
      padding-top: 10px;
      border-top: 1px solid #d0e4ea;
      font-size: 7.5pt;
      color: #5a7a85;
      display: flex;
      flex-wrap: wrap;
      gap: 12px 20px;
      justify-content: center;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="watermark">${clinicLogo}</div>
    <div class="content">
      <header class="header">
        <div class="header-logo">${clinicLogo}</div>
        <div class="header-center">
          <p class="doctor-name">${escapeHtml(map["{{nome_medico}}"])}</p>
          <p class="doctor-crm">Médico(a) • ${escapeHtml(crmLine)}</p>
        </div>
        <div class="qr-placeholder" title="QR Code"></div>
      </header>

      <p class="patient-row">
        <strong>Paciente</strong>
        <span class="patient-line">${escapeHtml(map["{{nome_paciente}}"])}</span>
      </p>

      <div class="badge-title">Solicitação de exames</div>

      <div class="exam-grid">${columnHtml}</div>
      ${notesBlock}

      <div class="sign-row">
        <div class="sign-box">
          <label>${escapeHtml(cityLine)},</label>
          <div class="sign-field">${d && m && y ? `${d} / ${m} / ${y}` : map["{{data_emissao}}"]}</div>
        </div>
        <div class="sign-box">
          <label>Carimbo e assinatura</label>
          <div class="sign-field sign-stamp-area">${doctorStamp}</div>
        </div>
      </div>

      ${contactParts.length ? `<div class="footer-contact">${contactParts.join(" &nbsp;|&nbsp; ")}</div>` : ""}
    </div>
  </div>
</body>
</html>`;
}
