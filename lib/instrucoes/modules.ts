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
      "Do primeiro contato até virar paciente — explicado de forma simples, com mapa visual e exemplos do dia a dia.",
    durationMin: 12,
    status: "available",
    href: "/dashboard/instrucoes/jornada-crm",
  },
  {
    id: "agenda",
    slug: "agenda",
    title: "Agenda e consultas",
    description:
      "Como a Maria virou consulta: agendar, confirmar e ver a agenda funcionar.",
    durationMin: 5,
    status: "available",
    href: "/dashboard/instrucoes/agenda",
  },
  {
    id: "financeiro",
    slug: "financeiro",
    title: "Financeiro e cobrança",
    description:
      "Do atendimento à comanda paga — o ciclo que fecha a clínica no dia a dia.",
    durationMin: 5,
    status: "available",
    href: "/dashboard/instrucoes/financeiro",
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
