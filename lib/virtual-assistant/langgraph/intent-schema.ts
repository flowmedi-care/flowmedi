import { z } from "zod";
import type { InboundIntent } from "../detect-inbound-intent";

export const GraphIntentSchema = z.enum([
  "booking",
  "availability_check",
  "pricing",
  "quote",
  "my_appointments",
  "reschedule",
  "cancel",
  "payment",
  "form",
  "hours_location",
  "human_handoff",
  "greeting",
  "general",
  "unknown",
]);

export type GraphIntent = z.infer<typeof GraphIntentSchema>;

export const IntentEntitiesSchema = z.object({
  procedure_name: z.string().optional(),
  doctor_name: z.string().optional(),
  time_reference: z.string().optional(),
  period: z.enum(["manha", "tarde"]).optional(),
});

export type IntentEntities = z.infer<typeof IntentEntitiesSchema>;

export const ClassifiedIntentSchema = z.object({
  intent: GraphIntentSchema,
  confidence: z.number().min(0).max(1),
  entities: IntentEntitiesSchema,
  missing_slots: z.array(z.string()),
});

export type ClassifiedIntent = z.infer<typeof ClassifiedIntentSchema>;

export function graphIntentToInboundIntent(intent: GraphIntent): InboundIntent {
  if (intent === "general") return "unknown";
  return intent;
}

export function inboundIntentFromClassification(
  classified: ClassifiedIntent
): InboundIntent {
  return graphIntentToInboundIntent(classified.intent);
}

export const CLASSIFY_INTENT_SYSTEM = `Você classifica mensagens de pacientes de clínicas médicas no WhatsApp.
Retorne JSON com intent, confidence (0-1), entities e missing_slots.

Intents:
- booking: quer agendar/marcar consulta ou procedimento
- availability_check: pergunta se TEM horário/vaga (ex: "tem horário semana que vem?") — NÃO confundir com horário de funcionamento da clínica
- pricing: quer saber preço/valor
- quote: quer orçamento formal
- my_appointments: consultar agendamentos existentes
- reschedule: remarcar
- cancel: cancelar consulta
- payment: pagamento, pix, comprovante
- form: formulário
- hours_location: horário de FUNCIONAMENTO da clínica, endereço, como chegar
- human_handoff: quer falar com atendente humano
- greeting: só saudação sem pedido
- general: outro assunto
- unknown: não deu para entender

missing_slots para availability_check/booking: procedure, doctor, time_reference quando não mencionados.
entities.time_reference: "semana que vem", "quinta", "amanhã", etc.`;
