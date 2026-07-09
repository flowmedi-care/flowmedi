import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildInvalidSlotSelectionReply,
  matchOfferedSlot,
} from "../booking-executor";
import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import type { AiConversationState, OfferedSlot } from "@/lib/virtual-assistant/types";

const slots: OfferedSlot[] = [
  { scheduled_at: "2026-07-11T12:00:00.000Z", display: "12:00" },
  { scheduled_at: "2026-07-11T12:30:00.000Z", display: "12:30" },
  { scheduled_at: "2026-07-11T13:00:00.000Z", display: "13:00" },
  { scheduled_at: "2026-07-11T13:30:00.000Z", display: "13:30" },
  { scheduled_at: "2026-07-11T14:00:00.000Z", display: "14:00" },
  { scheduled_at: "2026-07-11T14:30:00.000Z", display: "14:30" },
];

describe("matchOfferedSlot", () => {
  it("seleciona opção 6 mesmo com booking_step confirm", () => {
    const result = matchOfferedSlot("6", slots, "confirm");
    assert.equal(result?.display, "14:30");
  });

  it("seleciona 14:30 por horário", () => {
    const result = matchOfferedSlot("14:30", slots, "confirm");
    assert.equal(result?.display, "14:30");
  });

  it("retorna null para 15:30 fora da lista", () => {
    assert.equal(matchOfferedSlot("15:30", slots, "slot"), null);
  });

  it("retorna null para número 9 fora do range", () => {
    assert.equal(matchOfferedSlot("9", slots, "slot"), null);
  });

  it("não interpreta 6 como 06:00 quando é índice válido", () => {
    const result = matchOfferedSlot("6", slots, "slot");
    assert.equal(result?.display, "14:30");
    assert.notEqual(result?.display, "06:00");
  });
});

describe("buildInvalidSlotSelectionReply", () => {
  it("mensagem para horário fora da lista", () => {
    const reply = buildInvalidSlotSelectionReply("15:30", slots);
    assert.match(reply, /15:30/);
    assert.match(reply, /não está disponível/i);
    assert.match(reply, /1 a 6/);
  });

  it("mensagem para opção fora do range", () => {
    const reply = buildInvalidSlotSelectionReply("9", slots);
    assert.match(reply, /opção 9/i);
    assert.match(reply, /1 a 6/);
  });
});

describe("applyReplyGuards — invalid slot selection", () => {
  const state: AiConversationState = {
    intent: "booking",
    booking_step: "slot",
    last_display_message: "1) 12:00\n2) 12:30",
    offered_slots: slots,
  };

  it("não substitui resposta de seleção inválida pela last_display_message", () => {
    const invalidReply =
      "O horário 15:30 não está disponível. Escolha um número de 1 a 6 ou digite um horário da lista.";
    assert.equal(applyReplyGuards(invalidReply, state), invalidReply);
  });

  it("respeita last_reply_kind invalid_slot_selection", () => {
    const generic = "Falta só confirmar o horário escolhido.";
    const withKind = { ...state, last_reply_kind: "invalid_slot_selection" };
    assert.equal(applyReplyGuards(generic, withKind), generic);
  });
});
