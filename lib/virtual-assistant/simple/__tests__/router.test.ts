import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAssistantRoute } from "../router";

describe("resolveAssistantRoute", () => {
  it("greeting → route greeting", () => {
    const { route } = resolveAssistantRoute({
      inboundText: "Oi",
      aiState: {},
    });
    assert.equal(route.route, "greeting");
    assert.equal(route.intent, "greeting");
  });

  it("discovery → route discovery (general intent preserved)", () => {
    const { route } = resolveAssistantRoute({
      inboundText: "Com o que vocês trabalham?",
      aiState: {},
    });
    assert.equal(route.route, "discovery");
    assert.equal(route.intent, "general");
  });

  it("menu 1 → booking", () => {
    const { route, aiState } = resolveAssistantRoute({
      inboundText: "1",
      aiState: {},
    });
    assert.equal(route.route, "booking");
    assert.equal(aiState.booking_step, "procedure");
  });

  it("menu 2 → discovery", () => {
    const { route } = resolveAssistantRoute({
      inboundText: "2",
      aiState: {},
    });
    assert.equal(route.route, "discovery");
  });

  it("menu 3 → handoff", () => {
    const { route } = resolveAssistantRoute({
      inboundText: "3",
      aiState: {},
    });
    assert.equal(route.route, "handoff");
  });

  it("dormant booking + discovery clears stale step", () => {
    const { route, aiState } = resolveAssistantRoute({
      inboundText: "Com o que vocês trabalham?",
      aiState: { booking_step: "procedure" },
    });
    assert.equal(route.route, "discovery");
    assert.equal(aiState.booking_step, undefined);
  });

  it("active booking context → booking continuity", () => {
    const { route } = resolveAssistantRoute({
      inboundText: "2",
      aiState: {
        booking_step: "slot",
        procedure_id: "p1",
        doctor_id: "d1",
        offered_slots: [{ scheduled_at: "2026-07-10T14:00:00Z", display: "14:00" }],
      },
    });
    assert.equal(route.route, "booking");
    assert.equal(route.source, "continuity");
  });

  it("pricing intent → pricing route", () => {
    const { route } = resolveAssistantRoute({
      inboundText: "Quanto custa endoscopia?",
      aiState: {},
    });
    assert.equal(route.route, "pricing");
    assert.equal(route.intent, "pricing");
  });

  it("handoff intent → handoff route", () => {
    const { route } = resolveAssistantRoute({
      inboundText: "Quero falar com um atendente",
      aiState: {},
    });
    assert.equal(route.route, "handoff");
  });
});
