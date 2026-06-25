export const SITE_THEME = {
  primary: "#0A6EBD",
  accent: "#22C55E",
  background: "#F5F7FA",
  text: "#1E293B",
  muted: "#64748B",
  white: "#FFFFFF",
} as const;

export const DEFAULT_HERO_HEADLINE =
  "Cuidando da sua saúde com excelência e humanidade";

export const DEFAULT_HERO_SUBHEADLINE =
  "Atendimento especializado, tecnologia moderna e profissionais qualificados para cuidar de você e da sua família.";

/** Imagem hero padrão (foto profissional de clínica) */
export const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80";

export function siteThemeCssVars(overrides?: { primary?: string | null; accent?: string | null }) {
  return {
    "--site-primary": overrides?.primary || SITE_THEME.primary,
    "--site-accent": overrides?.accent || SITE_THEME.accent,
    "--site-bg": SITE_THEME.background,
    "--site-text": SITE_THEME.text,
    "--site-muted": SITE_THEME.muted,
  } as Record<string, string>;
}

export function formatDoctorCrm(crm: string | null, crmUf: string | null): string | null {
  if (crm && crmUf) return `CRM/${crmUf} ${crm}`;
  if (crm) return `CRM ${crm}`;
  return null;
}

export function googleMapsEmbedUrl(mapsUrl: string | null): string | null {
  if (!mapsUrl?.trim()) return null;
  const url = mapsUrl.trim();
  if (url.includes("/embed")) return url;
  return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
}
