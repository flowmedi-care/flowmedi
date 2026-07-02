import {
  ASSISTANT_TOOL_CATALOG,
  type AssistantToolCategory,
  type AssistantToolCatalogEntry,
} from "../tools/catalog";
import type { PromptFlow } from "./prompt-decision";

const FLOW_CATEGORIES: Record<PromptFlow, AssistantToolCategory[] | "all"> = {
  booking: ["paciente", "agendamento"],
  pricing: ["precos", "comercial"],
  appointments: ["paciente", "agendamento"],
  general: "all",
};

const TOOL_NEVER: Partial<Record<string, string>> = {
  lookup_patient_by_phone: "Nunca responda sobre cadastro sem chamar esta ferramenta.",
  find_available_slots: "Nunca invente horários — use display_message retornado.",
  create_appointment: "Nunca diga que agendou sem esta ferramenta retornar appointmentId.",
  get_service_price: "Nunca informe preço sem chamar esta ferramenta ou list_price_options.",
  list_patient_appointments: "Nunca confirme consultas existentes sem listar antes.",
  transfer_to_human: "Nunca transfira durante agendamento ativo.",
  get_payment_status: "Nunca confirme pagamento recebido — só leitura.",
};

function filterTools(flow: PromptFlow): AssistantToolCatalogEntry[] {
  const cats = FLOW_CATEGORIES[flow];
  if (cats === "all") return ASSISTANT_TOOL_CATALOG;
  return ASSISTANT_TOOL_CATALOG.filter((t) => cats.includes(t.category));
}

export function buildPromptTools(flow: PromptFlow): string {
  const tools = filterTools(flow);
  const lines = [
    `# Ferramentas disponíveis`,
    `Para cada situação abaixo, chame a ferramenta ANTES de responder.`,
    ``,
  ];

  for (const t of tools) {
    lines.push(`## ${t.label} (${t.name})`);
    lines.push(`Quando: ${t.whenToUse}`);
    lines.push(`Descrição: ${t.description}`);
    const never = TOOL_NEVER[t.name];
    if (never) lines.push(`Nunca: ${never}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}
