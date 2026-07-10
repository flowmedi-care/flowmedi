import { z } from "zod";
import type { ActiveFlow } from "../../domain/conversation/active-flow";
import type { BookingDraft } from "../../domain/booking/booking-draft";
import type { CrmDraft } from "../../domain/crm/crm-draft";
import type { FaqDraft } from "../../domain/faq/faq-draft";
import type { PricingDraft } from "../../domain/pricing/pricing-draft";

const bookingDraftSchema = z.object({
  step: z.enum([
    "identify_patient",
    "select_service",
    "select_professional",
    "select_datetime",
    "confirm",
  ]),
  mode: z.enum(["create", "reschedule", "cancel"]),
  patientRef: z.object({ id: z.string() }).nullable(),
  serviceId: z.string().nullable(),
  professionalId: z.string().nullable(),
  slot: z
    .object({
      start: z.string(),
      end: z.string(),
      professionalId: z.string().nullable(),
    })
    .nullable(),
});

const pricingDraftSchema = z.object({
  step: z.enum(["select_service", "present_quote"]),
  serviceId: z.string().nullable(),
  quote: z
    .object({
      amount: z.number(),
      currency: z.string(),
      breakdown: z.string().optional(),
    })
    .nullable(),
});

const faqDraftSchema = z.object({
  lastQuery: z.string().nullable(),
  lastAnswerId: z.string().nullable(),
  discoveryMode: z.boolean().optional(),
});

const crmDraftSchema = z.object({
  step: z.enum(["collect_contact", "collect_interest"]),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  interest: z.string().nullable(),
});

const activeFlowSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("booking"), draft: bookingDraftSchema }),
  z.object({ kind: z.literal("pricing"), draft: pricingDraftSchema }),
  z.object({ kind: z.literal("faq"), draft: faqDraftSchema }),
  z.object({ kind: z.literal("crm"), draft: crmDraftSchema }),
]);

export type SerializedActiveFlow = z.infer<typeof activeFlowSchema>;

export const conversationSnapshotSchema = z.object({
  conversationId: z.string(),
  clinicId: z.string(),
  channel: z.enum(["whatsapp", "instagram", "webchat"]),
  externalThreadId: z.string(),
  status: z.enum(["open", "awaiting_consent", "in_flow", "handoff", "closed"]),
  patientId: z.string().nullable(),
  consent: z.object({
    status: z.enum(["unknown", "granted", "denied"]),
    deferredIntent: z
      .enum(["booking", "pricing", "faq", "discovery", "crm", "handoff", "cancel", "unknown"])
      .nullable(),
    recordedAt: z.string().nullable(),
  }),
  handoffTicketId: z.string().nullable(),
  handoffStartedAt: z.string().nullable(),
  activeFlow: activeFlowSchema.nullable(),
  version: z.number().int().nonnegative(),
  lastUserMessageAt: z.string(),
});

export type ConversationSnapshot = z.infer<typeof conversationSnapshotSchema>;

export function parseActiveFlow(raw: unknown): ActiveFlow | null {
  const parsed = activeFlowSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data as ActiveFlow;
}

export type {
  BookingDraft,
  PricingDraft,
  FaqDraft,
  CrmDraft,
};
