import type { KnowledgePackage } from "../context/build-knowledge-package";
import type { ResolvedCapabilities } from "../capabilities/definitions";
import { RUNTIME_CAPABILITY_DEFS } from "../capabilities/definitions";

function formatHours(hours: unknown): string {
  if (!hours || typeof hours !== "object") return "";
  return JSON.stringify(hours);
}

function formatPrice(min?: unknown, max?: unknown, note?: unknown): string {
  if (note === "consultar" || (min == null && max == null)) return "preço sob consulta";
  const a = Number(min);
  const b = Number(max);
  if (!Number.isFinite(a)) return "preço sob consulta";
  if (!Number.isFinite(b) || a === b) return `R$ ${a.toFixed(2)}`;
  return `de R$ ${a.toFixed(2)} a R$ ${b.toFixed(2)}`;
}

/**
 * Serializes the structured Knowledge Package into prompt text.
 * Provider-agnostic string form; swap this layer for Claude/Gemini formatting later.
 */
export function buildPromptFromPackage(input: {
  clinicName: string;
  package: KnowledgePackage;
  capabilities: ResolvedCapabilities;
}): string {
  const sections: string[] = [
    `# Dados da clínica (fatos — use ferramentas para valores/horários exatos)`,
  ];
  const clinic = input.package.clinic;
  if (clinic) {
    if (clinic.about) sections.push(`Sobre: ${clinic.about}`);
    if (clinic.address) sections.push(`Endereço: ${clinic.address}`);
    if (clinic.maps) sections.push(`Maps: ${clinic.maps}`);
    if (clinic.landmarks) sections.push(`Referências: ${clinic.landmarks}`);
    if (clinic.parking) sections.push(`Estacionamento: ${clinic.parking}`);
    if (clinic.accessibility) sections.push(`Acessibilidade: ${clinic.accessibility}`);
    if (clinic.phone) sections.push(`Tel: ${clinic.phone}`);
    if (clinic.email) sections.push(`E-mail: ${clinic.email}`);
    if (clinic.hours) sections.push(`# Horários\n${formatHours(clinic.hours)}`);
    if (Array.isArray(clinic.paymentMethods) && clinic.paymentMethods.length) {
      sections.push(`Formas de pagamento: ${(clinic.paymentMethods as string[]).join(", ")}`);
    }
    if (clinic.promotions) sections.push(`Promoções: ${clinic.promotions}`);
    if (clinic.cancellationPolicy) sections.push(`Cancelamento: ${clinic.cancellationPolicy}`);
    if (Array.isArray(clinic.units) && clinic.units.length) {
      const lines = (clinic.units as { name?: string; address?: string; google_maps_url?: string }[]).map(
        (l) => [l.name, l.address, l.google_maps_url].filter(Boolean).join(" | ")
      );
      sections.push(`# Unidades\n${lines.join("\n")}`);
    }
  }

  const procs = input.package.procedures?.items as Record<string, unknown>[] | undefined;
  if (procs?.length) {
    const lines = procs.map((p) => {
      const parts = [`- ${p.name}`];
      if (p.durationMinutes != null) parts.push(`~${p.durationMinutes} min`);
      if (p.shortDescription) parts.push(String(p.shortDescription).slice(0, 120));
      if (p.howWePerform) parts.push(`Como: ${String(p.howWePerform).slice(0, 150)}`);
      if (p.prep) parts.push(`Preparo: ${String(p.prep).slice(0, 100)}`);
      if (p.recovery) parts.push(`Recuperação: ${String(p.recovery).slice(0, 100)}`);
      parts.push(`[procedure_id: ${p.id}]`);
      return parts.join(" | ");
    });
    sections.push(`# Procedimentos\n${lines.join("\n")}`);
  }

  const services = input.package.services?.items as Record<string, unknown>[] | undefined;
  if (services?.length) {
    const lines = services.map((s) => {
      const price = formatPrice(s.priceMin, s.priceMax, s.priceNote);
      return `- ${s.name}${s.category ? ` (${s.category})` : ""} | ${price} [service_id: ${s.id}]`;
    });
    sections.push(`# Serviços\n${lines.join("\n")}`);
  }

  const faq = input.package.knowledge_base?.entries as
    | { question: string; answer: string }[]
    | undefined;
  if (faq?.length) {
    sections.push(
      `# Base de conhecimento\n${faq.map((f) => `P: ${f.question}\nR: ${f.answer}`).join("\n\n")}`
    );
  }

  const prompts: string[] = [];
  for (const id of input.capabilities.enabled) {
    const hint = RUNTIME_CAPABILITY_DEFS[id]?.requiredPrompt;
    if (hint) prompts.push(hint);
  }
  if (prompts.length) {
    sections.push(`# Políticas ativas\n${prompts.map((p) => `- ${p}`).join("\n")}`);
  }

  return sections.filter(Boolean).join("\n\n");
}
