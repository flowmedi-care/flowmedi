import type { QuoteDetail, QuoteRenderContext } from "./types";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function logoImg(url: string | null, scale: number | null, alt: string): string {
  if (!url) return "";
  const w = scale ? Math.round(80 * scale) : 80;
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="max-width:${w}px;max-height:60px;object-fit:contain;" />`;
}

function renderItemsTable(
  items: QuoteDetail["items"],
  title: string,
  showSeparateNote: boolean
): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(item.description)}${item.bill_separately ? " <span class=\"tag\">cobrado à parte</span>" : ""}</td>
        <td class="num">${Number(item.quantity).toLocaleString("pt-BR")}</td>
        <td class="num">${fmt(Number(item.unit_price))}</td>
        <td class="num">${fmt(Number(item.total_price))}</td>
      </tr>`
    )
    .join("");
  const subtotal = items.reduce((s, i) => s + Number(i.total_price), 0);
  return `
    <h2 class="section-title">${escapeHtml(title)}</h2>
    ${showSeparateNote ? '<p class="section-note">Itens marcados como cobrados à parte não compõem o total de serviços.</p>' : ""}
    <table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Descrição</th>
          <th>Qtd</th>
          <th>Unit.</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="num">Subtotal</td>
          <td class="num">${fmt(subtotal)}</td>
        </tr>
      </tfoot>
    </table>`;
}

export function renderQuoteHtml(ctx: QuoteRenderContext): string {
  const { clinic, quote, recipient, professional_name, emission_date } = ctx;
  const serviceItems = quote.items.filter((i) => i.section === "services");
  const materialItems = quote.items.filter((i) => i.section === "materials");
  const otherItems = quote.items.filter((i) => i.section === "other");
  const separateMaterials = materialItems.filter((i) => i.bill_separately);
  const includedMaterials = materialItems.filter((i) => !i.bill_separately);

  const clinicLogo = logoImg(clinic.logo_url, clinic.logo_scale, clinic.name);
  const validUntil = quote.valid_until
    ? new Date(`${quote.valid_until}T12:00:00`).toLocaleDateString("pt-BR")
    : "—";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Orçamento #${quote.quote_number} — ${escapeHtml(clinic.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #111;
      margin: 0;
      padding: 0;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 14mm;
      min-height: 277mm;
    }
    .header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .clinic-name { font-size: 16pt; font-weight: 700; margin: 0 0 4px; color: #0f766e; }
    .clinic-meta { font-size: 9pt; color: #555; margin: 0; }
    .doc-title {
      text-align: center;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      margin: 0 0 16px;
      text-transform: uppercase;
      color: #134e4a;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .meta-block {
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .meta-block h3 {
      margin: 0 0 8px;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #0f766e;
    }
    .meta-block p { margin: 2px 0; font-size: 10pt; }
    .section-title {
      font-size: 11pt;
      font-weight: 600;
      color: #134e4a;
      margin: 20px 0 8px;
      border-bottom: 1px solid #ccfbf1;
      padding-bottom: 4px;
    }
    .section-note { font-size: 9pt; color: #666; margin: 0 0 8px; }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    .items-table th, .items-table td {
      border: 1px solid #e5e7eb;
      padding: 8px 10px;
      text-align: left;
    }
    .items-table th { background: #f9fafb; font-weight: 600; }
    .items-table .num { text-align: right; white-space: nowrap; }
    .items-table tfoot td { font-weight: 600; background: #f9fafb; }
    .tag {
      display: inline-block;
      font-size: 8pt;
      background: #fef3c7;
      color: #92400e;
      padding: 1px 6px;
      border-radius: 4px;
      margin-left: 4px;
    }
    .totals {
      margin-top: 20px;
      margin-left: auto;
      width: 280px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 14px;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row:last-child {
      border-bottom: none;
      background: #0f766e;
      color: white;
      font-weight: 700;
      font-size: 12pt;
    }
    .notes {
      margin-top: 24px;
      padding: 12px 14px;
      background: #fafafa;
      border-radius: 8px;
      font-size: 9.5pt;
      color: #444;
    }
    .notes h3 { margin: 0 0 6px; font-size: 10pt; color: #333; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 10mm; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      ${clinicLogo ? `<div>${clinicLogo}</div>` : ""}
      <div>
        <p class="clinic-name">${escapeHtml(clinic.name)}</p>
        ${clinic.address ? `<p class="clinic-meta">${escapeHtml(clinic.address)}</p>` : ""}
        ${clinic.phone ? `<p class="clinic-meta">Tel: ${escapeHtml(clinic.phone)}</p>` : ""}
        ${clinic.email ? `<p class="clinic-meta">${escapeHtml(clinic.email)}</p>` : ""}
      </div>
    </header>

    <h1 class="doc-title">Proposta Comercial · Orçamento #${String(quote.quote_number).padStart(4, "0")}</h1>

    <div class="meta-grid">
      <div class="meta-block">
        <h3>Destinatário</h3>
        <p><strong>${escapeHtml(recipient.name)}</strong></p>
        ${recipient.phone ? `<p>Tel: ${escapeHtml(recipient.phone)}</p>` : ""}
        ${recipient.email ? `<p>E-mail: ${escapeHtml(recipient.email)}</p>` : ""}
      </div>
      <div class="meta-block">
        <h3>Proposta</h3>
        <p>Emissão: ${escapeHtml(emission_date)}</p>
        <p>Validade: ${escapeHtml(validUntil)}</p>
        ${professional_name ? `<p>Elaborado por: ${escapeHtml(professional_name)}</p>` : ""}
      </div>
    </div>

    ${renderItemsTable(serviceItems, "Serviços e procedimentos", false)}
    ${renderItemsTable(includedMaterials, "Materiais inclusos", false)}
    ${renderItemsTable(separateMaterials, "Materiais (cobrados separadamente)", true)}
    ${renderItemsTable(otherItems, "Outros itens", false)}

    <div class="totals">
      <div class="totals-row"><span>Subtotal serviços</span><span>${fmt(quote.subtotal)}</span></div>
      ${
        quote.discount_amount > 0
          ? `<div class="totals-row"><span>Desconto</span><span>- ${fmt(quote.discount_amount)}</span></div>`
          : ""
      }
      ${
        separateMaterials.length > 0
          ? `<div class="totals-row"><span>Materiais à parte</span><span>${fmt(separateMaterials.reduce((s, i) => s + Number(i.total_price), 0))}</span></div>`
          : ""
      }
      <div class="totals-row"><span>Total proposto</span><span>${fmt(quote.total_amount)}</span></div>
    </div>

    ${
      quote.notes || quote.terms
        ? `<div class="notes">
            ${quote.notes ? `<h3>Observações</h3><p>${escapeHtml(quote.notes).replace(/\n/g, "<br/>")}</p>` : ""}
            ${quote.terms ? `<h3>Condições</h3><p>${escapeHtml(quote.terms).replace(/\n/g, "<br/>")}</p>` : ""}
          </div>`
        : ""
    }
  </div>
</body>
</html>`;
}
