export type InstructionModule = {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationMin?: number;
  status: "available" | "coming_soon";
  href: string;
};

export const INSTRUCTION_MODULES: InstructionModule[] = [
  {
    id: "jornada-crm",
    slug: "jornada-crm",
    title: "Jornada do lead",
    description:
      "Funil CRM, jornada operacional com ramificações e score de priorização — do primeiro contato ao cliente.",
    durationMin: 12,
    status: "available",
    href: "/dashboard/instrucoes/jornada-crm",
  },
  {
    id: "agenda",
    slug: "agenda",
    title: "Agenda e consultas",
    description: "Agendar, confirmar, check-in e comparecimento.",
    status: "coming_soon",
    href: "/dashboard/instrucoes",
  },
  {
    id: "financeiro",
    slug: "financeiro",
    title: "Financeiro e cobrança",
    description: "Cupom, contas a receber e fluxo de caixa.",
    status: "coming_soon",
    href: "/dashboard/instrucoes",
  },
  {
    id: "mensagens",
    slug: "mensagens",
    title: "Comunicação com pacientes",
    description: "WhatsApp, templates e eventos automáticos.",
    status: "coming_soon",
    href: "/dashboard/instrucoes",
  },
];
