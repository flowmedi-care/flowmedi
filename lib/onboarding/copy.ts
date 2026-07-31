import type { OnboardingTourStep } from "./types";

export const MARIA_STORY = {
  name: "Maria Silva",
  channelLabel: "Busca no Google",
  reasonLabel: "Avaliação / primeira consulta",
  isDemo: true as const,
  whyExists:
    "Criamos uma paciente fictícia para você experimentar o fluxo completo sem medo de errar. Pode apagar depois.",
  channelDetail:
    "Maria pesquisou um especialista perto de si, encontrou sua clínica e pediu uma avaliação.",
};

export const ACTIVATION_SPLASH =
  "Sua clínica já existe. Em segundos você vê o FlowMedi funcionando — com a Maria.";

export const ANCHOR_PHRASE =
  "Veja sua clínica funcionando antes mesmo de terminar a configuração.";

export type StepCopy = {
  step: OnboardingTourStep;
  coachTitle: string;
  coachBody: string;
  ctaLabel: string;
  microWin: string;
  progressStatus: string;
};

export const STEP_COPY: Record<
  Exclude<OnboardingTourStep, "done" | "skipped" | "aha">,
  StepCopy
> = {
  contact: {
    step: "contact",
    coachTitle: "Maria está esperando",
    coachBody:
      "Maria pediu uma avaliação e apareceu como pendência. Abra e agende a consulta.",
    ctaLabel: "Agendar consulta da Maria",
    microWin: "Seu primeiro paciente apareceu.",
    progressStatus: "Sua clínica recebeu um contato.",
  },
  appointment: {
    step: "appointment",
    coachTitle: "Sua primeira consulta está pronta",
    coachBody: "Tudo já está preenchido. Só confirme para marcar a Maria na agenda.",
    ctaLabel: "Confirmar consulta",
    microWin: "Sua agenda já tem um atendimento.",
    progressStatus: "Sua agenda já tem um atendimento.",
  },
  attendance: {
    step: "attendance",
    coachTitle: "Maria chegou",
    coachBody: "Finalize o atendimento de demonstração com um clique.",
    ctaLabel: "Concluir atendimento demo",
    microWin: "Atendimento concluído.",
    progressStatus: "Um atendimento foi concluído.",
  },
  payment: {
    step: "payment",
    coachTitle: "Registre o pagamento",
    coachBody: "Emita a comanda e registre o pagamento — como no dia a dia real.",
    ctaLabel: "Emitir e receber",
    microWin: "Dinheiro registrado.",
    progressStatus: "O pagamento entrou no financeiro.",
  },
};

export const MINI_AHA = {
  title: "Sua agenda funciona.",
  body: "Maria já está marcada. Vamos até o pagamento para ver a clínica completa?",
  continueLabel: "Continuar",
  laterLabel: "Ver depois",
};

export const FULL_AHA_BEATS = [
  "Sua clínica acabou de funcionar pela primeira vez.",
  "Em poucos minutos você passou por todo o ciclo de uma consulta.",
  "Agora imagine isso acontecendo com pacientes reais.",
] as const;

export const FULL_AHA_MODULES = ["CRM", "Agenda", "Atendimento", "Financeiro"] as const;

export const COMMITMENT = {
  title: "Agora é sua vez.",
  body: "Vamos substituir a Maria pelos seus primeiros pacientes reais.",
};

export const POST_AHA_CTAS = [
  {
    id: "equipe",
    label: "Convidar equipe",
    href: "/dashboard/equipe",
  },
  {
    id: "servicos",
    label: "Cadastrar serviços reais",
    href: "/dashboard/servicos-valores/servicos",
  },
  {
    id: "whatsapp",
    label: "Conectar WhatsApp",
    href: "/dashboard/configuracoes/integracoes",
  },
] as const;

export function microWinForStep(step: OnboardingTourStep): string | null {
  if (step === "contact") return STEP_COPY.contact.microWin;
  if (step === "appointment") return STEP_COPY.appointment.microWin;
  if (step === "attendance") return STEP_COPY.attendance.microWin;
  if (step === "payment") return STEP_COPY.payment.microWin;
  if (step === "aha" || step === "done") return "Você viu o FlowMedi completo.";
  return null;
}
