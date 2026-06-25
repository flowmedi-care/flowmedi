import type { PublicClinicSite } from "@/lib/public-site/types";
import { DAY_LABELS } from "@/lib/public-site/types";
import type { DayKey } from "@/lib/virtual-assistant/types";

const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type ClinicSegment = "clinica" | "restaurante" | "loja" | "outro";

export type SegmentCopy = {
  heroEyebrow: string;
  heroSubtitleFallback: string;
  servicesEyebrow: string;
  servicesTitle: string;
  servicesDescription: string;
  teamEyebrow: string;
  teamTitle: string;
  teamDescription: string;
  ctaLabel: string;
  cardActionLabel: string;
};

const SEGMENT_COPY: Record<ClinicSegment, SegmentCopy> = {
  clinica: {
    heroEyebrow: "Cuidado com você",
    heroSubtitleFallback:
      "Atendimento humanizado, profissionais qualificados e um ambiente pensado para o seu bem-estar.",
    servicesEyebrow: "Tratamentos",
    servicesTitle: "Procedimentos disponíveis",
    servicesDescription:
      "Conheça os atendimentos oferecidos e escolha o que melhor atende às suas necessidades.",
    teamEyebrow: "Especialistas",
    teamTitle: "Nossa equipe",
    teamDescription: "Profissionais dedicados ao seu cuidado e bem-estar.",
    ctaLabel: "Agendar consulta",
    cardActionLabel: "Agendar",
  },
  restaurante: {
    heroEyebrow: "Bem-vindo",
    heroSubtitleFallback: "Experiência, qualidade e atendimento que fazem a diferença.",
    servicesEyebrow: "Cardápio",
    servicesTitle: "Nossos serviços",
    servicesDescription: "Opções disponíveis para você escolher.",
    teamEyebrow: "Equipe",
    teamTitle: "Quem cuida de você",
    teamDescription: "Profissionais prontos para oferecer a melhor experiência.",
    ctaLabel: "Reservar",
    cardActionLabel: "Reservar",
  },
  loja: {
    heroEyebrow: "Bem-vindo",
    heroSubtitleFallback: "Atendimento personalizado e soluções sob medida para você.",
    servicesEyebrow: "Serviços",
    servicesTitle: "O que oferecemos",
    servicesDescription: "Conheça nossas opções e agende quando for melhor para você.",
    teamEyebrow: "Equipe",
    teamTitle: "Nossa equipe",
    teamDescription: "Profissionais prontos para ajudar.",
    ctaLabel: "Agendar",
    cardActionLabel: "Agendar",
  },
  outro: {
    heroEyebrow: "Bem-vindo",
    heroSubtitleFallback: "Qualidade, confiança e atendimento dedicado.",
    servicesEyebrow: "Serviços",
    servicesTitle: "O que oferecemos",
    servicesDescription: "Conheça nossas opções disponíveis.",
    teamEyebrow: "Equipe",
    teamTitle: "Nossa equipe",
    teamDescription: "Profissionais prontos para atender você.",
    ctaLabel: "Agendar",
    cardActionLabel: "Agendar",
  },
};

export function normalizeSegment(segment: string | null | undefined): ClinicSegment {
  if (segment === "restaurante" || segment === "loja" || segment === "outro") return segment;
  return "clinica";
}

export function getSegmentCopy(segment: string | null | undefined): SegmentCopy {
  return SEGMENT_COPY[normalizeSegment(segment)];
}

export function getServiceGridClass(count: number): string {
  if (count <= 1) return "grid grid-cols-1 gap-5 max-w-md mx-auto";
  if (count === 2) return "grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto";
  if (count === 3) return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5";
  if (count === 4) return "grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto";
  return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5";
}

export function truncateText(text: string, maxLength = 100): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}…`;
}

export function getTodayHoursLabel(hours: PublicClinicSite["operating_hours"]): string | null {
  const key = JS_DAY_TO_KEY[new Date().getDay()];
  const day = hours[key];
  if (!day || day.closed) return "Fechado hoje";
  const open = day.open ?? "";
  const close = day.close ?? "";
  if (!open || !close) return null;
  return `Hoje: ${open} às ${close}`;
}

export function formatHoursTable(hours: PublicClinicSite["operating_hours"]) {
  const keys = Object.keys(DAY_LABELS) as DayKey[];
  return keys
    .map((key) => {
      const day = hours[key];
      if (!day) return null;
      if (day.closed) {
        return { label: DAY_LABELS[key], value: "Fechado", closed: true };
      }
      const open = day.open ?? "—";
      const close = day.close ?? "—";
      let value = `${open} – ${close}`;
      if (day.lunch_start && day.lunch_end) {
        value += ` · almoço ${day.lunch_start}–${day.lunch_end}`;
      }
      const isToday = JS_DAY_TO_KEY[new Date().getDay()] === key;
      return { label: DAY_LABELS[key], value, closed: false, isToday };
    })
    .filter(Boolean) as {
    label: string;
    value: string;
    closed: boolean;
    isToday?: boolean;
  }[];
}
