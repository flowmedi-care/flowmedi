import type { CopyVariant } from "@/lib/outbound/message";

export type ClinicasCopy = {
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
};

export const CLINICAS_COPY: Record<CopyVariant, ClinicasCopy> = {
  A: {
    headline:
      "Sua clínica pode atender mais rápido, perder menos pacientes e organizar toda a operação em um único lugar.",
    subheadline:
      "Uma plataforma criada para clínicas de estética que centraliza atendimento, agenda, pacientes e automações inteligentes.",
    primaryCta: "Agendar demonstração",
    secondaryCta: "Quero conhecer",
  },
  B: {
    headline:
      "Centralize o atendimento da clínica em um único lugar.",
    subheadline:
      "Organize pacientes, agenda e equipe sem depender de várias ferramentas. Automatize o repetitivo para focar no atendimento.",
    primaryCta: "Agendar demonstração",
    secondaryCta: "Ver como funciona",
  },
  C: {
    headline:
      "Menos WhatsApp lotado. Mais pacientes confirmados.",
    subheadline:
      "FlowMed reúne atendimento, agenda e acompanhamento para clínicas de estética — com automações que a equipe controla.",
    primaryCta: "Falar no WhatsApp",
    secondaryCta: "Ver o sistema",
  },
};

export const PRODUCT_FLOW = [
  { id: "whatsapp", label: "WhatsApp", description: "Mensagem chega" },
  { id: "ia", label: "IA responde", description: "Atendimento imediato" },
  { id: "agenda", label: "Agenda", description: "Horário marcado" },
  { id: "crm", label: "CRM", description: "Histórico do paciente" },
  { id: "financeiro", label: "Financeiro", description: "Cobrança em ordem" },
  { id: "pos", label: "Pós-consulta", description: "Follow-up automático" },
] as const;

export const HOW_IT_WORKS = [
  { step: 1, title: "Recebe mensagem", description: "O paciente fala no WhatsApp da clínica." },
  { step: 2, title: "IA atende", description: "Resposta imediata, com o tom da sua clínica." },
  { step: 3, title: "Agenda automaticamente", description: "Horário confirmado sem troca de planilha." },
  { step: 4, title: "Clínica acompanha tudo", description: "Equipe vê conversas, agenda e histórico em um lugar." },
] as const;

export const BEFORE_ITEMS = [
  "Secretária responde tudo.",
  "WhatsApp lotado.",
  "Pacientes esquecidos.",
  "Follow-up manual.",
] as const;

export const AFTER_ITEMS = [
  "IA responde imediatamente.",
  "Agenda organizada.",
  "Lembretes automáticos.",
  "Histórico completo.",
] as const;

export const DEMO_FEATURES = [
  {
    id: "dashboard",
    feature: "dashboard",
    title: "Painel",
    image: "/landing/screen-dashboard.png",
  },
  {
    id: "whatsapp",
    feature: "whatsapp",
    title: "Atendimento",
    image: "/landing/screen-chat.png",
  },
  {
    id: "crm",
    feature: "crm",
    title: "CRM",
    image: "/landing/screen-crm.png",
  },
  {
    id: "agenda",
    feature: "agenda",
    title: "Relatórios",
    image: "/landing/screen-reports.png",
  },
] as const;

export const FOR_WHOM = [
  "Clínica de estética",
  "Harmonização facial",
  "Dermatologia",
  "Estética avançada",
  "Clínicas com equipe",
] as const;

export const CLINICAS_FAQ = [
  {
    question: "Funciona com WhatsApp?",
    answer:
      "Sim. O atendimento entra pelo WhatsApp da clínica e fica centralizado no FlowMed, com histórico e acompanhamento da equipe.",
  },
  {
    question: "Preciso trocar meu número?",
    answer:
      "Na maioria dos casos, não. Trabalhamos com o número que a clínica já usa no atendimento.",
  },
  {
    question: "Quanto tempo leva para começar?",
    answer:
      "Em geral, a clínica começa a usar em poucos dias após a configuração inicial e o alinhamento do fluxo de atendimento.",
  },
  {
    question: "Minha secretária continua usando?",
    answer:
      "Sim. A equipe acompanha conversas, agenda e pacientes no mesmo painel — a IA ajuda no repetitivo, sem substituir o controle humano.",
  },
  {
    question: "A IA responde sozinha?",
    answer:
      "Ela pode responder de forma autônoma nas rotinas que você definir. A clínica decide o que é automático e o que exige a equipe.",
  },
  {
    question: "Posso acompanhar tudo?",
    answer:
      "Sim. Conversas, agenda, pacientes e automações ficam visíveis para quem tiver permissão na clínica.",
  },
] as const;
