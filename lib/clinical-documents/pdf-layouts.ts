/** Bundled print layouts for clinical documents (exam requests, certificates). */

export const CLINICAL_PDF_LAYOUTS = [
  {
    id: "clinical",
    label: "Clínico",
    description: "Logo, CRM, QR code e rodapé com contato da clínica.",
  },
  {
    id: "minimal",
    label: "Minimalista",
    description: "Layout limpo, sem QR code, tipografia enxuta.",
  },
  {
    id: "institutional",
    label: "Institucional",
    description: "Cabeçalho centralizado com destaque para a clínica.",
  },
  {
    id: "compact",
    label: "Compacto",
    description: "Máximo aproveitamento de espaço para listas longas.",
  },
] as const;

export type ClinicalPdfLayoutId = (typeof CLINICAL_PDF_LAYOUTS)[number]["id"];

export const DEFAULT_CLINICAL_PDF_LAYOUT: ClinicalPdfLayoutId = "clinical";

export function isClinicalPdfLayoutId(value: string): value is ClinicalPdfLayoutId {
  return CLINICAL_PDF_LAYOUTS.some((l) => l.id === value);
}

export function getClinicalPdfLayout(id: string | null | undefined) {
  if (id && isClinicalPdfLayoutId(id)) {
    return CLINICAL_PDF_LAYOUTS.find((l) => l.id === id)!;
  }
  return CLINICAL_PDF_LAYOUTS.find((l) => l.id === DEFAULT_CLINICAL_PDF_LAYOUT)!;
}

export type LayoutTheme = {
  primary: string;
  text: string;
  muted: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  notesBg: string;
  fontTitle: string;
  fontBody: string;
  pagePadding: string;
  headerAlign: "space-between" | "center";
  showQr: boolean;
  showFooterContact: boolean;
  compactSpacing: boolean;
};

export function getLayoutTheme(layoutId: ClinicalPdfLayoutId): LayoutTheme {
  const base: LayoutTheme = {
    primary: "#0d6b7d",
    text: "#1a3339",
    muted: "#5a7a85",
    border: "#0d6b7d",
    badgeBg: "#0d6b7d",
    badgeText: "#fff",
    notesBg: "#f4fafb",
    fontTitle: '"Segoe UI", system-ui, sans-serif',
    fontBody: '"Segoe UI", system-ui, sans-serif',
    pagePadding: "14mm 16mm",
    headerAlign: "space-between",
    showQr: true,
    showFooterContact: true,
    compactSpacing: false,
  };

  switch (layoutId) {
    case "minimal":
      return {
        ...base,
        primary: "#334155",
        border: "#cbd5e1",
        badgeBg: "#334155",
        notesBg: "#f8fafc",
        showQr: false,
        showFooterContact: false,
      };
    case "institutional":
      return {
        ...base,
        primary: "#1e3a5f",
        border: "#1e3a5f",
        badgeBg: "#1e3a5f",
        fontTitle: "Georgia, serif",
        headerAlign: "center",
        showQr: false,
      };
    case "compact":
      return {
        ...base,
        pagePadding: "10mm 12mm",
        compactSpacing: true,
        showQr: false,
      };
    default:
      return base;
  }
}

export function buildLayoutCss(theme: LayoutTheme): string {
  const lineGap = theme.compactSpacing ? "8px" : "14px";
  const linePad = theme.compactSpacing ? "8px" : "12px";
  const headerDir = theme.headerAlign === "center" ? "column" : "row";

  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${theme.fontBody};
      font-size: ${theme.compactSpacing ? "10pt" : "11pt"};
      color: ${theme.text};
      background: #fff;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: ${theme.pagePadding};
      min-height: 277mm;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      flex-direction: ${headerDir};
      align-items: ${theme.headerAlign === "center" ? "center" : "flex-start"};
      justify-content: ${theme.headerAlign};
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid ${theme.border};
      margin-bottom: ${theme.compactSpacing ? "12px" : "16px"};
      text-align: ${theme.headerAlign === "center" ? "center" : "left"};
    }
    .header-left { flex: 1; }
    .clinic-name { font-size: 11pt; font-weight: 600; color: ${theme.primary}; margin-top: 6px; }
    .doctor-block { text-align: ${theme.headerAlign === "center" ? "center" : "right"}; }
    .doctor-name {
      font-family: ${theme.fontTitle};
      font-size: 13pt;
      font-weight: 600;
      color: ${theme.text};
    }
    .doctor-crm { font-size: 9pt; color: ${theme.muted}; margin-top: 2px; }
    .qr-img { display: block; margin-top: 6px; ${theme.headerAlign === "center" ? "margin-left: auto; margin-right: auto;" : "margin-left: auto;"} border-radius: 4px; }
    .title-badge {
      display: inline-block;
      background: ${theme.badgeBg};
      color: ${theme.badgeText};
      font-size: 10pt;
      font-weight: 600;
      padding: 6px 18px;
      border-radius: 18px;
      margin-bottom: ${theme.compactSpacing ? "12px" : "16px"};
    }
    .patient-simple {
      font-size: 10.5pt;
      margin-bottom: ${theme.compactSpacing ? "12px" : "18px"};
      line-height: 1.6;
    }
    .patient-simple strong { color: ${theme.primary}; font-weight: 600; }
    .content-list { flex: 1; }
    .content-line {
      margin-bottom: ${lineGap};
      padding-bottom: ${linePad};
      border-bottom: 1px solid #e8f0f2;
    }
    .content-line:last-child { border-bottom: none; }
    .content-line-name { font-weight: 600; font-size: 11pt; color: ${theme.text}; margin-bottom: 4px; }
    .content-num { color: ${theme.primary}; }
    .content-line-details {
      font-size: 10pt;
      color: #3d5a63;
      line-height: 1.45;
      padding-left: 18px;
      margin: 0;
    }
    .content-notes {
      margin-top: 12px;
      padding: 10px 12px;
      background: ${theme.notesBg};
      border-radius: 6px;
      font-size: 10pt;
      border-left: 3px solid ${theme.primary};
    }
    .sign-footer {
      margin-top: auto;
      padding-top: 24px;
      display: flex;
      justify-content: flex-end;
    }
    .sign-block { width: 55%; text-align: right; }
    .sign-date { font-size: 10pt; color: #3d5a63; margin-bottom: 28px; }
    .sign-area { border-top: 1px solid #8eb4c0; padding-top: 6px; min-height: 22mm; }
    .sign-label { font-size: 8.5pt; color: ${theme.muted}; text-align: right; }
    .footer-contact {
      margin-top: 12px;
      font-size: 8pt;
      color: #7a949c;
      text-align: center;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4; margin: 10mm; }
    }
  `;
}
