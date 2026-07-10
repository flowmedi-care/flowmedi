import { patchBookingDraft } from "../../domain/booking/booking-draft";
import { nextBookingStep } from "../../domain/booking/booking-step";
import { patientRef } from "../../domain/shared/patient-ref";
import type { HandlerContext, DomainHandler } from "./handler-types";
import { literalReply } from "./handler-types";
import { idempotencyKey } from "../../tools/adapters/supabase-adapters";

export class FaqHandler implements DomainHandler {
  async handle(ctx: HandlerContext) {
    const flow = ctx.conversation.activeFlow;
    if (flow?.kind !== "faq") {
      return {
        type: "complete" as const,
        reply: literalReply("Como posso ajudar com suas dúvidas?"),
      };
    }

    const query = ctx.input.text.trim();
    if (!query) {
      return {
        type: "stay" as const,
        reply: literalReply("Pode me contar sua dúvida?"),
      };
    }

    const result = await ctx.tools.execute(
      {
        name: "searchFaq",
        args: { query },
      },
      {
        clinicId: ctx.conversation.clinicId,
        conversationId: ctx.conversation.id,
        phoneNumber: ctx.phoneNumber,
        domain: "faq",
        fsmState: "faq.ask",
        turnId: ctx.turnId,
      }
    );

    if (!result.ok || !result.data) {
      return {
        type: "stay" as const,
        reply: literalReply(
          "Não encontrei essa informação agora. Quer falar com a equipe? Digite *atendente*."
        ),
      };
    }

    const data = result.data as { id: string; answer: string; question: string };
    ctx.conversation.advanceFlow({
      kind: "faq",
      draft: { lastQuery: query, lastAnswerId: data.id },
    });

    return {
      type: "complete" as const,
      reply: literalReply(data.answer),
    };
  }
}

export const faqHandler = new FaqHandler();

export class PricingHandler implements DomainHandler {
  async handle(ctx: HandlerContext) {
    const flow = ctx.conversation.activeFlow;
    if (flow?.kind !== "pricing") {
      ctx.conversation.startPricing();
    }
    const active = ctx.conversation.activeFlow;
    if (active?.kind !== "pricing") {
      return { type: "stay" as const, reply: literalReply("Qual serviço você quer consultar o preço?") };
    }

    const toolCtx = {
      clinicId: ctx.conversation.clinicId,
      conversationId: ctx.conversation.id,
      phoneNumber: ctx.phoneNumber,
      domain: "pricing",
      fsmState: active.draft.step === "select_service" ? "pricing.collect_service" : "pricing.present",
      turnId: ctx.turnId,
    };

    if (active.draft.step === "select_service") {
      const services = await ctx.tools.execute({ name: "listServices", args: {} }, toolCtx);
      if (!services.ok) {
        return { type: "fail" as const, reply: literalReply("Não consegui listar serviços agora."), recoverable: true };
      }
      const list = services.data as Array<{ id: string; name: string }>;
      const match = list.find((s) =>
        ctx.input.text.toLowerCase().includes(s.name.toLowerCase())
      ) ?? list[0];
      if (!match) {
        return { type: "stay" as const, reply: literalReply("Qual procedimento ou serviço você quer saber o valor?") };
      }
      ctx.conversation.advanceFlow({
        kind: "pricing",
        draft: { ...active.draft, serviceId: match.id, step: "present_quote" },
      });
    }

    const updated = ctx.conversation.activeFlow;
    if (updated?.kind !== "pricing" || !updated.draft.serviceId) {
      return { type: "stay" as const, reply: literalReply("Qual serviço?") };
    }

    const quote = await ctx.tools.execute(
      { name: "getPriceQuote", args: { serviceId: updated.draft.serviceId } },
      { ...toolCtx, fsmState: "pricing.present" }
    );
    if (!quote.ok) {
      return { type: "fail" as const, reply: literalReply("Não consegui consultar o preço."), recoverable: true };
    }
    const data = quote.data as { amount: number; currency: string; breakdown?: string };
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: data.currency || "BRL",
    }).format(data.amount);

    ctx.conversation.advanceFlow({
      kind: "pricing",
      draft: {
        ...updated.draft,
        quote: { amount: data.amount, currency: data.currency, breakdown: data.breakdown },
      },
    });

    return {
      type: "complete" as const,
      reply: literalReply(
        data.breakdown
          ? `O valor é ${formatted} (${data.breakdown}).`
          : `O valor é ${formatted}.`
      ),
    };
  }
}

export const pricingHandler = new PricingHandler();

export class CrmHandler implements DomainHandler {
  async handle(ctx: HandlerContext) {
    let flow = ctx.conversation.activeFlow;
    if (flow?.kind !== "crm") {
      ctx.conversation.startCrm();
      flow = ctx.conversation.activeFlow;
    }
    if (flow?.kind !== "crm") {
      return { type: "stay" as const, reply: literalReply("Qual seu nome completo?") };
    }

    const toolCtx = {
      clinicId: ctx.conversation.clinicId,
      conversationId: ctx.conversation.id,
      phoneNumber: ctx.phoneNumber,
      domain: "crm",
      fsmState:
        flow.draft.step === "collect_contact"
          ? "crm.collect_contact"
          : "crm.collect_interest",
      turnId: ctx.turnId,
    };

    if (flow.draft.step === "collect_contact") {
      const name = ctx.input.text.trim();
      ctx.conversation.advanceFlow({
        kind: "crm",
        draft: {
          ...flow.draft,
          name,
          phone: ctx.phoneNumber,
          step: "collect_interest",
        },
      });
      return {
        type: "advance" as const,
        reply: literalReply("Obrigado! Qual procedimento ou assunto te interessa?"),
      };
    }

    const interest = ctx.input.text.trim();
    const draft = flow.draft;
    const lead = await ctx.tools.execute(
      {
        name: "createLead",
        args: {
          name: draft.name,
          phone: draft.phone,
          email: draft.email,
          interest,
        },
        idempotencyKey: idempotencyKey(ctx.conversation.id, ctx.turnId, "createLead"),
      },
      { ...toolCtx, fsmState: "crm.collect_interest" }
    );
    if (!lead.ok) {
      return { type: "fail" as const, reply: literalReply("Não consegui registrar seu contato."), recoverable: true };
    }
    return {
      type: "complete" as const,
      reply: literalReply("Recebemos seu contato! Nossa equipe retorna em breve."),
    };
  }
}

export const crmHandler = new CrmHandler();

export class HandoffHandler implements DomainHandler {
  async handle(ctx: HandlerContext) {
    const fsmState =
      ctx.conversation.status === "handoff" ? "handoff.active" : "handoff.pending";

    if (fsmState === "handoff.active") {
      await ctx.tools.execute(
        {
          name: "appendHandoffMessage",
          args: { text: ctx.input.text },
        },
        {
          clinicId: ctx.conversation.clinicId,
          conversationId: ctx.conversation.id,
          phoneNumber: ctx.phoneNumber,
          domain: "handoff",
          fsmState: "handoff.active",
          turnId: ctx.turnId,
        }
      );
      return { type: "stay" as const, reply: { mode: "silent" as const } };
    }

    const ticket = await ctx.tools.execute(
      {
        name: "openHandoffTicket",
        args: {},
        idempotencyKey: idempotencyKey(ctx.conversation.id, ctx.turnId, "openHandoffTicket"),
      },
      {
        clinicId: ctx.conversation.clinicId,
        conversationId: ctx.conversation.id,
        phoneNumber: ctx.phoneNumber,
        domain: "handoff",
        fsmState: "handoff.pending",
        turnId: ctx.turnId,
      }
    );
    if (!ticket.ok) {
      return { type: "fail" as const, reply: literalReply("Não consegui transferir agora."), recoverable: true };
    }
    const data = ticket.data as { ticketId: string };
    ctx.conversation.enterHandoff(data.ticketId);
    return {
      type: "advance" as const,
      reply: literalReply("Estou transferindo você para nossa equipe. Aguarde um momento."),
    };
  }
}

export const handoffHandler = new HandoffHandler();

export class BookingHandler implements DomainHandler {
  async handle(ctx: HandlerContext) {
    let flow = ctx.conversation.activeFlow;
    if (flow?.kind !== "booking") {
      ctx.conversation.startBooking();
      flow = ctx.conversation.activeFlow;
    }
    if (flow?.kind !== "booking") {
      return { type: "stay" as const, reply: literalReply("Vamos agendar. Qual seu nome completo?") };
    }

    const draft = flow.draft;
    const toolCtxBase = {
      clinicId: ctx.conversation.clinicId,
      conversationId: ctx.conversation.id,
      phoneNumber: ctx.phoneNumber,
      domain: "booking",
      turnId: ctx.turnId,
    };

    switch (draft.step) {
      case "identify_patient": {
        const found = await ctx.tools.execute(
          { name: "findPatient", args: {} },
          { ...toolCtxBase, fsmState: "booking.collect_patient" }
        );
        let ref = draft.patientRef;
        if (found.ok && found.data) {
          const p = found.data as { id: string };
          ref = patientRef(String(p.id));
          ctx.conversation.linkPatient(ref);
        } else {
          const created = await ctx.tools.execute(
            {
              name: "createPatient",
              args: { name: ctx.input.text.trim(), phone: ctx.phoneNumber },
              idempotencyKey: idempotencyKey(ctx.conversation.id, ctx.turnId, "createPatient"),
            },
            { ...toolCtxBase, fsmState: "booking.collect_patient" }
          );
          if (created.ok && created.data) {
            ref = patientRef(String((created.data as { id: string }).id));
            ctx.conversation.linkPatient(ref);
          }
        }
        ctx.conversation.advanceFlow({
          kind: "booking",
          draft: patchBookingDraft(draft, {
            patientRef: ref,
            step: nextBookingStep("identify_patient") ?? "select_service",
          }),
        });
        return {
          type: "advance" as const,
          reply: literalReply("Qual procedimento ou tipo de consulta você deseja?"),
        };
      }
      case "select_service": {
        const services = await ctx.tools.execute(
          { name: "listServices", args: {} },
          { ...toolCtxBase, fsmState: "booking.collect_service" }
        );
        const list = services.ok ? (services.data as Array<{ id: string; name: string }>) : [];
        const match =
          list.find((s) => ctx.input.text.toLowerCase().includes(s.name.toLowerCase())) ??
          list[0];
        if (!match) {
          return { type: "stay" as const, reply: literalReply("Qual serviço você quer agendar?") };
        }
        ctx.conversation.advanceFlow({
          kind: "booking",
          draft: patchBookingDraft(draft, {
            serviceId: match.id,
            step: "select_datetime",
          }),
        });
        return {
          type: "advance" as const,
          reply: literalReply("Qual dia prefere? (ex.: amanhã, segunda, 15/07)"),
        };
      }
      case "select_datetime": {
        const date = new Date().toISOString().slice(0, 10);
        const slots = await ctx.tools.execute(
          { name: "listSlots", args: { serviceId: draft.serviceId, date } },
          { ...toolCtxBase, fsmState: "booking.collect_datetime" }
        );
        const list = slots.ok
          ? (slots.data as Array<{ start: string; end: string; professionalId: string; display: string }>)
          : [];
        const pick = list[0];
        if (!pick) {
          return { type: "fail" as const, reply: literalReply("Sem horários agora."), recoverable: true };
        }
        ctx.conversation.advanceFlow({
          kind: "booking",
          draft: patchBookingDraft(draft, {
            step: "confirm",
            slot: {
              start: pick.start,
              end: pick.end,
              professionalId: pick.professionalId,
            },
            professionalId: pick.professionalId,
          }),
        });
        return {
          type: "advance" as const,
          reply: literalReply(
            `Confirmo agendamento em ${pick.display}? Responda *sim* para confirmar.`
          ),
        };
      }
      case "confirm": {
        if (!/^(sim|s|confirmo|ok)/i.test(ctx.input.text.trim())) {
          return {
            type: "stay" as const,
            reply: literalReply("Responda *sim* para confirmar ou *cancelar* para desistir."),
          };
        }
        if (!draft.patientRef || !draft.serviceId || !draft.slot) {
          return { type: "fail" as const, reply: literalReply("Dados incompletos."), recoverable: true };
        }
        const created = await ctx.tools.execute(
          {
            name: "createAppointment",
            args: {
              patientId: draft.patientRef.id,
              serviceId: draft.serviceId,
              procedureId: draft.serviceId,
              professionalId: draft.slot.professionalId,
              scheduledAt: draft.slot.start,
              start: draft.slot.start,
            },
            idempotencyKey: idempotencyKey(ctx.conversation.id, ctx.turnId, "createAppointment"),
          },
          { ...toolCtxBase, fsmState: "booking.confirm" }
        );
        if (!created.ok) {
          return {
            type: "fail" as const,
            reply: literalReply(created.error ?? "Não consegui agendar."),
            recoverable: true,
          };
        }
        return {
          type: "complete" as const,
          reply: literalReply("Consulta agendada com sucesso! Até breve."),
        };
      }
      default:
        return { type: "stay" as const, reply: literalReply("Continuando agendamento...") };
    }
  }
}

export const bookingHandler = new BookingHandler();
