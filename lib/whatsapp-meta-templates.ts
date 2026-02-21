/**
 * Mapeamento de event_code → template Meta para envio fora da janela de 24h.
 * Templates: flowmedi_consulta | flowmedi_formulario | flowmedi_aviso
 * Ver docs/WHATSAPP-META-TEMPLATES-GUIA-COMPLETO.md
 */

import type { VariableContext } from "./message-variables";

export type MetaTemplateName = "flowmedi_consulta" | "flowmedi_formulario" | "flowmedi_aviso";

export interface MetaTemplateConfig {
  template: MetaTemplateName;
  /** Frase/instrução principal ({{2}} em consulta e formulário, {{2}} em aviso) */
  phrase: string;
}

function formatDateTime(date: string | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Extrai variáveis planas a partir do VariableContext */
function contextToVariables(ctx: VariableContext) {
  return {
    nome_paciente: ctx.paciente?.nome ?? "",
    nome_clinica: ctx.clinica?.nome ?? "",
    nome_medico: ctx.consulta?.nome_medico ?? "",
    data_hora_consulta: formatDateTime(ctx.consulta?.data_hora),
    instrucao_formulario: ctx.formulario?.link
      ? `Para preencher antes da consulta, acesse: ${ctx.formulario.link}`
      : "",
  };
}

const MAPPING: Record<string, MetaTemplateConfig> = {
  // flowmedi_consulta
  appointment_created: {
    template: "flowmedi_consulta",
    phrase: "Confirmamos o agendamento da sua consulta.",
  },
  appointment_rescheduled: {
    template: "flowmedi_consulta",
    phrase: "Informamos que sua consulta foi remarcada.",
  },
  appointment_confirmed: {
    template: "flowmedi_consulta",
    phrase: "Recebemos sua confirmação. Sua consulta está agendada.",
  },
  appointment_not_confirmed: {
    template: "flowmedi_consulta",
    phrase: "Sua consulta ainda não foi confirmada. Por favor, confirme sua presença ou entre em contato.",
  },
  appointment_reminder_30d: {
    template: "flowmedi_consulta",
    phrase: "Lembramos que você tem consulta agendada em 30 dias.",
  },
  appointment_reminder_15d: {
    template: "flowmedi_consulta",
    phrase: "Lembramos que sua consulta está agendada em 15 dias.",
  },
  appointment_reminder_7d: {
    template: "flowmedi_consulta",
    phrase: "Lembramos que sua consulta é na próxima semana.",
  },
  appointment_reminder_48h: {
    template: "flowmedi_consulta",
    phrase: "Sua consulta está agendada para daqui a 48 horas.",
  },
  appointment_reminder_24h: {
    template: "flowmedi_consulta",
    phrase: "Lembramos que sua consulta é amanhã.",
  },
  appointment_reminder_2h: {
    template: "flowmedi_consulta",
    phrase: "Sua consulta é em 2 horas.",
  },
  return_appointment_reminder: {
    template: "flowmedi_consulta",
    phrase: "Lembramos que você tem consulta de retorno agendada.",
  },
  appointment_marked_as_return: {
    template: "flowmedi_consulta",
    phrase: "Informamos que sua consulta foi marcada como retorno.",
  },
  // flowmedi_formulario
  form_linked: {
    template: "flowmedi_formulario",
    phrase: "Precisamos que você preencha um formulário antes da sua consulta.",
  },
  form_link_sent: {
    template: "flowmedi_formulario",
    phrase: "Enviamos o link para que você preencha o formulário antes da sua consulta.",
  },
  form_reminder: {
    template: "flowmedi_formulario",
    phrase: "Lembramos que você ainda precisa preencher o formulário vinculado à sua consulta.",
  },
  form_incomplete: {
    template: "flowmedi_formulario",
    phrase: "O formulário não foi preenchido completamente. Por favor, complete todos os campos.",
  },
  // flowmedi_aviso
  appointment_canceled: {
    template: "flowmedi_aviso",
    phrase: "Informamos que sua consulta foi cancelada. Para reagendar, entre em contato conosco.",
  },
  appointment_no_show: {
    template: "flowmedi_aviso",
    phrase: "Registramos que você não pôde comparecer à consulta. Para reagendar, entre em contato conosco.",
  },
  appointment_completed: {
    template: "flowmedi_aviso",
    phrase: "Obrigado por comparecer à consulta. Foi um prazer atendê-lo(a).",
  },
  form_completed: {
    template: "flowmedi_aviso",
    phrase: "Muito obrigado por preencher o formulário. Recebemos suas informações.",
  },
  patient_form_completed: {
    template: "flowmedi_aviso",
    phrase: "Muito obrigado por preencher o formulário. Recebemos suas informações.",
  },
  public_form_completed: {
    template: "flowmedi_aviso",
    phrase: "Obrigado por entrar em contato. Recebemos suas informações e em breve entraremos em contato.",
  },
  patient_registered: {
    template: "flowmedi_aviso",
    phrase: "Bem-vindo à nossa clínica. Você foi cadastrado em nosso sistema e em breve poderá agendar sua primeira consulta.",
  },
};

/**
 * Obtém o nome do template Meta e os parâmetros para envio.
 * @param customPhrase - Frase personalizada do template (whatsapp_meta_phrase). Se fornecida, substitui a padrão do MAPPING.
 */
export function getMetaTemplateParams(
  eventCode: string,
  context: VariableContext,
  customPhrase?: string | null
): { template: MetaTemplateName; params: string[] } | undefined {
  const config = MAPPING[eventCode];
  if (!config) return undefined;

  const phrase = (customPhrase && customPhrase.trim()) || config.phrase;

  const v = contextToVariables(context);
  const nome = (v.nome_paciente || "Paciente").slice(0, 256);
  const clinica = (v.nome_clinica || "").slice(0, 256);
  const medico = (v.nome_medico || "").slice(0, 256);
  const dataHora = (v.data_hora_consulta || "").slice(0, 256);
  const instrucao = (v.instrucao_formulario || "").slice(0, 256);

  switch (config.template) {
    case "flowmedi_consulta": {
      // {{2}} = mensagem completa: frase + data/hora + médico
      const mensagemCompleta =
        dataHora && medico
          ? `${phrase} Data e hora: ${dataHora}. Médico(a): ${medico}.`
          : dataHora
            ? `${phrase} Data e hora: ${dataHora}.`
            : phrase;
      return {
        template: "flowmedi_consulta",
        params: [nome, mensagemCompleta, clinica],
      };
    }
    case "flowmedi_formulario":
      return {
        template: "flowmedi_formulario",
        params: [nome, instrucao || phrase || "Acesse o link enviado anteriormente.", clinica],
      };
    case "flowmedi_aviso":
      return {
        template: "flowmedi_aviso",
        params: [nome, phrase, clinica],
      };
    default:
      return undefined;
  }
}
