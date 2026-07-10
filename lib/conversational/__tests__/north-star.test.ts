import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Conversation } from "../domain/conversation/conversation";
import { initialBookingDraft, canAdvanceBookingDraft } from "../domain/booking/booking-draft";
import { patientRef } from "../domain/shared/patient-ref";
import { requiresConsent } from "../domain/services/consent-policy";
import { ConversationMapper } from "../infrastructure/persistence/conversation-mapper";
import { nextStateAfterOutcome, nextStateAfterReceive } from "../fsm/transitions";
import { northStarFlagsFromSettings, shouldRunNorthStar } from "../feature-flags";

describe("Conversation aggregate", () => {
  it("starts booking flow and enforces invariants", () => {
    const conv = Conversation.openNew({
      id: "c1",
      clinicId: "clinic1",
      channel: "whatsapp",
      externalThreadId: "+5511999999999",
    });
    conv.startBooking();
    assert.equal(conv.status, "in_flow");
    assert.equal(conv.activeFlow?.kind, "booking");
  });

  it("clears flow on abort", () => {
    const conv = Conversation.openNew({
      id: "c1",
      clinicId: "clinic1",
      channel: "whatsapp",
      externalThreadId: "+5511999999999",
    });
    conv.startPricing();
    conv.abortFlow();
    assert.equal(conv.status, "open");
    assert.equal(conv.activeFlow, null);
  });

  it("stores deferred intent in consent record", () => {
    const conv = Conversation.openNew({
      id: "c1",
      clinicId: "clinic1",
      channel: "whatsapp",
      externalThreadId: "+5511999999999",
    });
    conv.requestConsent("booking");
    assert.equal(conv.consent.deferredIntent, "booking");
    assert.equal(conv.status, "awaiting_consent");
  });
});

describe("BookingDraft", () => {
  it("validates advance rules", () => {
    const draft = initialBookingDraft();
    assert.equal(canAdvanceBookingDraft(draft), false);
    const withPatient = {
      ...draft,
      patientRef: patientRef("p1"),
      step: "identify_patient" as const,
    };
    assert.equal(canAdvanceBookingDraft(withPatient), true);
  });
});

describe("ConsentPolicy", () => {
  it("requires consent for booking when unknown", () => {
    assert.equal(
      requiresConsent({
        intent: "booking",
        channel: "whatsapp",
        consent: { status: "unknown", deferredIntent: null, recordedAt: null },
        requiresConsentForMessaging: true,
      }),
      true
    );
  });
});

describe("ConversationMapper", () => {
  it("roundtrips snapshot", () => {
    const conv = Conversation.openNew({
      id: "c1",
      clinicId: "clinic1",
      channel: "whatsapp",
      externalThreadId: "phone",
    });
    conv.startFaq();
    const snapshot = ConversationMapper.toSnapshot(conv);
    const restored = ConversationMapper.toDomain(snapshot);
    assert.equal(restored.activeFlow?.kind, "faq");
    assert.equal(restored.id, "c1");
  });
});

describe("FSM transitions", () => {
  it("routes idle booking intent", () => {
    const next = nextStateAfterReceive("idle", {
      interrupt: null,
      intent: "booking",
      confirmation: null,
    });
    assert.equal(next, "booking.collect_patient");
  });

  it("advances booking collect_patient", () => {
    const next = nextStateAfterOutcome("booking.collect_patient", "advance");
    assert.equal(next, "booking.collect_service");
  });

  it("cancel returns idle", () => {
    const next = nextStateAfterReceive("booking.collect_service", {
      interrupt: { type: "cancel" },
      intent: null,
      confirmation: null,
    });
    assert.equal(next, "idle");
  });
});

describe("Feature flags", () => {
  it("defaults to off", () => {
    const flags = northStarFlagsFromSettings({});
    assert.equal(flags.mode, "off");
    assert.equal(shouldRunNorthStar(flags, "any").run, false);
  });

  it("shadow runs without sendReply", () => {
    const flags = northStarFlagsFromSettings({ north_star_mode: "shadow" });
    const gate = shouldRunNorthStar(flags, "clinic1");
    assert.equal(gate.run, true);
    assert.equal(gate.sendReply, false);
    assert.equal(gate.shadow, true);
  });

  it("full mode sends reply", () => {
    const flags = northStarFlagsFromSettings({ north_star_enabled: true });
    const gate = shouldRunNorthStar(flags, "clinic1");
    assert.equal(gate.sendReply, true);
  });
});
