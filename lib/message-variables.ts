/**
 * Sistema de substituição de variáveis em templates de mensagens
 */

export type VariableContext = {
  // Dados do paciente
  paciente?: {
    nome?: string;
    email?: string;
    telefone?: string;
    data_nascimento?: string;
  };
  // Dados da consulta
  consulta?: {
    data?: string;
    hora?: string;
    data_hora?: string;
    nome_medico?: string;
    tipo?: string;
    procedimento?: string;
    status?: string;
    local?: string;
    recomendacoes?: string;
    precisa_jejum?: boolean;
    instrucoes_especiais?: string;
    notas_preparo?: string;
  };
  // Dados do formulário
  formulario?: {
    link?: string;
    nome?: string;
    prazo?: string;
  };
  // Dados da clínica
  clinica?: {
    nome?: string;
    telefone?: string;
    endereco?: string;
  };
};

/**
 * Formata data no formato brasileiro
 */
function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formata hora no formato brasileiro
 */
function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formata data e hora juntas
 */
function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${formatDate(d)} às ${formatTime(d)}`;
}

/**
 * Gera texto completo de preparo baseado nos campos da consulta
 */
function generatePreparoCompleto(context: VariableContext): string {
  const consulta = context.consulta;
  if (!consulta) return "";

  const partes: string[] = [];

  if (consulta.precisa_jejum) {
    partes.push("⚠️ Comparecer em jejum de 8 horas.");
  }

  if (consulta.recomendacoes) {
    partes.push(`📋 Recomendações:\n${consulta.recomendacoes}`);
  }

  if (consulta.instrucoes_especiais) {
    partes.push(`📝 Instruções especiais:\n${consulta.instrucoes_especiais}`);
  }

  if (consulta.notas_preparo) {
    partes.push(`📌 Notas de preparo:\n${consulta.notas_preparo}`);
  }

  return partes.join("\n\n");
}

/**
 * Mapeamento de variáveis para valores
 */
const VARIABLE_MAP: Record<string, (context: VariableContext) => string> = {
  // Variáveis de paciente
  "{{nome_paciente}}": (ctx) => ctx.paciente?.nome || "",
  "{{email_paciente}}": (ctx) => ctx.paciente?.email || "",
  "{{telefone_paciente}}": (ctx) => ctx.paciente?.telefone || "",
  "{{data_nascimento}}": (ctx) =>
    ctx.paciente?.data_nascimento
      ? formatDate(ctx.paciente.data_nascimento)
      : "",

  // Variáveis de consulta
  "{{data_consulta}}": (ctx) =>
    ctx.consulta?.data ? formatDate(ctx.consulta.data) : "",
  "{{hora_consulta}}": (ctx) =>
    ctx.consulta?.data ? formatTime(ctx.consulta.data) : "",
  "{{data_hora_consulta}}": (ctx) =>
    ctx.consulta?.data ? formatDateTime(ctx.consulta.data) : "",
  "{{nome_medico}}": (ctx) => ctx.consulta?.nome_medico || "",
  "{{tipo_consulta}}": (ctx) => ctx.consulta?.tipo || "",
  "{{nome_procedimento}}": (ctx) => ctx.consulta?.procedimento || "",
  "{{status_consulta}}": (ctx) => ctx.consulta?.status || "",
  "{{local_consulta}}": (ctx) => ctx.consulta?.local || "",

  // Variáveis de recomendações/preparação
  "{{recomendacoes}}": (ctx) => ctx.consulta?.recomendacoes || "",
  "{{precisa_jejum}}": (ctx) =>
    ctx.consulta?.precisa_jejum ? "Sim" : "Não",
  "{{instrucoes_especiais}}": (ctx) =>
    ctx.consulta?.instrucoes_especiais || "",
  "{{notas_preparo}}": (ctx) => ctx.consulta?.notas_preparo || "",
  "{{preparo_completo}}": (ctx) => generatePreparoCompleto(ctx),
  "{{preparo_completo_html}}": (ctx) => {
    const preparo = generatePreparoCompleto(ctx);
    if (!preparo) return "";
    const preparoHtml = preparo.replace(/\n/g, "<br>");
    return `<div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 12px; margin: 16px 0;">
  <h3 style="margin-top: 0; color: #0369a1;">Instruções de Preparo:</h3>
  <div style="white-space: pre-wrap; font-family: inherit; margin: 0; color: #0c4a6e;">${preparoHtml}</div>
</div>`;
  },

  // Variáveis de formulário
  "{{link_formulario}}": (ctx) => ctx.formulario?.link || "",
  "{{nome_formulario}}": (ctx) => ctx.formulario?.nome || "",
  "{{prazo_formulario}}": (ctx) => ctx.formulario?.prazo || "",
  // Bloco condicional: só aparece quando há link (formulário pendente)
  "{{instrucao_formulario}}": (ctx) =>
    ctx.formulario?.link
      ? `Para preencher o formulário, acesse: ${ctx.formulario.link}`
      : "",

  // Variáveis de clínica
  "{{nome_clinica}}": (ctx) => ctx.clinica?.nome || "",
  "{{telefone_clinica}}": (ctx) => ctx.clinica?.telefone || "",
  "{{endereco_clinica}}": (ctx) => ctx.clinica?.endereco || "",
};

/**
 * Extrai todas as variáveis usadas em um texto
 */
export function extractVariables(text: string): string[] {
  const variables: string[] = [];
  const regex = /\{\{(\w+)\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const varName = `{{${match[1]}}}`;
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }

  return variables;
}

/**
 * Substitui variáveis em um texto pelos valores do contexto
 */
export function replaceVariables(
  text: string,
  context: VariableContext
): string {
  let result = text;

  for (const [variable, getValue] of Object.entries(VARIABLE_MAP)) {
    const value = getValue(context);
    result = result.replace(new RegExp(variable.replace(/[{}]/g, "\\$&"), "g"), value);
  }

  return result;
}

/**
 * Valida se todas as variáveis usadas no template existem
 */
export function validateVariables(
  text: string,
  availableVariables: string[] = Object.keys(VARIABLE_MAP)
): { valid: boolean; missing: string[] } {
  const used = extractVariables(text);
  const missing = used.filter((v) => !availableVariables.includes(v));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Gera contexto a partir de dados do banco
 */
export async function buildVariableContext(data: {
  patient?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    birth_date?: string | null;
  };
  appointment?: {
    scheduled_at?: string;
    status?: string;
    recommendations?: string | null;
    requires_fasting?: boolean;
    special_instructions?: string | null;
    preparation_notes?: string | null;
  };
  doctor?: {
    full_name?: string | null;
  };
  appointmentType?: {
    name?: string | null;
  };
  procedure?: {
    name?: string | null;
  };
  clinic?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  formInstance?: {
    link_token?: string | null;
    slug?: string | null;
    form_template?: {
      name?: string | null;
    } | null;
  };
}): Promise<VariableContext> {
  const context: VariableContext = {};

  // Dados do paciente
  if (data.patient) {
    context.paciente = {
      nome: data.patient.full_name || undefined,
      email: data.patient.email || undefined,
      telefone: data.patient.phone || undefined,
      data_nascimento: data.patient.birth_date || undefined,
    };
  }

  // Dados da consulta
  if (data.appointment) {
    context.consulta = {
      data: data.appointment.scheduled_at || undefined,
      hora: data.appointment.scheduled_at || undefined,
      data_hora: data.appointment.scheduled_at || undefined,
      nome_medico: data.doctor?.full_name || undefined,
      tipo: data.appointmentType?.name || undefined,
      procedimento: data.procedure?.name || undefined,
      status: data.appointment.status || undefined,
      recomendacoes: data.appointment.recommendations || undefined,
      precisa_jejum: data.appointment.requires_fasting || false,
      instrucoes_especiais: data.appointment.special_instructions || undefined,
      notas_preparo: data.appointment.preparation_notes || undefined,
    };
  }

  // Dados do formulário — link absoluto para emails (NEXT_PUBLIC_APP_URL ou VERCEL_URL)
  if (data.formInstance) {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      (typeof window !== "undefined" ? window.location.origin : undefined);
    const baseUrl = (origin ?? "").replace(/\/$/, "");
    // Priorizar slug se disponível, senão usar link_token (compatibilidade)
    const identifier = data.formInstance.slug || data.formInstance.link_token;
    const path = identifier ? `/f/${identifier}` : undefined;
    const link = path ? (baseUrl ? `${baseUrl}${path}` : path) : undefined;

    context.formulario = {
      link,
      nome: data.formInstance.form_template?.name || undefined,
    };
  }

  // Dados da clínica
  if (data.clinic) {
    context.clinica = {
      nome: data.clinic.name || undefined,
      telefone: data.clinic.phone || undefined,
      endereco: data.clinic.address || undefined,
    };
  }

  return context;
}
