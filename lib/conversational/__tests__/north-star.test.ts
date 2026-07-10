import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Conversation } from "../domain/conversation/conversation";
import { initialBookingDraft, canAdvanceBookingDraft } from "../domain/booking/booking-draft";
import { patientRef } from "../domain/shared/patient-ref";
import { requiresConsent } from "../domain/services/consent-policy";
import { ConversationMapper } from "../infrastructure/persistence/conversation-mapper";
import { nextStateAfterOutcome, nextStateAfterReceive } from "../fsm/transitions";
import { northStarFlagsFromSettings, shouldRunNorthStar, shouldUseBrainV2 } from "../feature-flags";
import { isGreeting } from "../fsm/idle-entry";
import { detectConfirmation } from "../fsm/global-interrupts";
import { InputResolver } from "../fsm/input-resolver";
import { KeywordLanguageService } from "../language/language-service";
import { TurnProcessor } from "../conversation/turn-processor";
import { ToolGateway } from "../tools/gateway";
import type { ConversationRepository } from "../domain/conversation/conversation-repository";
import type { ClinicConfig } from "../clinic/clinic-config";

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

  it("brain v2 flag", () => {
    const flags = northStarFlagsFromSettings({
      north_star_mode: "full",
      north_star_brain: "v2",
    });
    assert.equal(shouldUseBrainV2(flags, "any"), true);
    const canary = northStarFlagsFromSettings({
      north_star_mode: "full",
      brain_v2_canary_clinic_ids: ["clinic-x"],
    });
    assert.equal(shouldUseBrainV2(canary, "clinic-x"), true);
    assert.equal(shouldUseBrainV2(canary, "other"), false);
  });
});

describe("Greeting routing", () => {
  it("detects common greetings", () => {
    assert.equal(isGreeting("Oi"), true);
    assert.equal(isGreeting("Bom dia!"), true);
    assert.equal(isGreeting("Eu nao perguntei isso"), false);
  });

  it("routes Oi to greeting without faq intent", async () => {
    const conv = Conversation.openNew({
      id: "c1",
      clinicId: "clinic1",
      channel: "whatsapp",
      externalThreadId: "+5511999999999",
    });
    const resolver = new InputResolver({ language: new KeywordLanguageService() });
    const config: ClinicConfig = {
      clinicId: "clinic1",
      assistantName: "Assistente",
      requiresConsentForMessaging: true,
      llmDisabled: false,
      humanHandoffEnabled: true,
      faqs: [{ id: "f1", question: "Vida", answer: "A vida é uma maravilha" }],
    };
    const resolved = await resolver.resolve(conv, "Oi", config);
    assert.equal(resolved.intent, null);
  });
});

describe("Consent confirmation", () => {
  it("accepts natural language consent", () => {
    assert.equal(detectConfirmation("ok podemos tem o consentimento"), "yes");
    assert.equal(detectConfirmation("concordo"), "yes");
    assert.equal(detectConfirmation("aceito"), "yes");
    assert.equal(detectConfirmation("não autorizo"), "no");
  });
});

describe("TurnProcessor regressions", () => {
  class MemoryRepo implements ConversationRepository {
    private store = new Map<string, Conversation>();

    constructor(initial: Conversation) {
      this.store.set(initial.id, initial);
    }

    async findById(id: string) {
      return this.store.get(id) ?? null;
    }

    async findByExternalThread() {
      return null;
    }

    async save(conversation: Conversation, _expectedVersion: number) {
      this.store.set(conversation.id, conversation);
    }
  }

  const baseConfig: ClinicConfig = {
    clinicId: "clinic1",
    assistantName: "Flow",
    requiresConsentForMessaging: true,
    llmDisabled: false,
    humanHandoffEnabled: true,
    faqs: [{ id: "f1", question: "Vida", answer: "A vida é uma maravilha" }],
  };

  const mockTools = new ToolGateway({
    searchFaq: async () => ({ ok: true, data: null }),
    recordConsent: async () => ({ ok: true, data: { recorded: true } }),
  });

  it("Oi returns menu instead of first FAQ", async () => {
    const conv = Conversation.openNew({
      id: "c1",
      clinicId: "clinic1",
      channel: "whatsapp",
      externalThreadId: "+5511999999999",
    });
    const processor = new TurnProcessor({
      repository: new MemoryRepo(conv),
      tools: mockTools,
      language: new KeywordLanguageService(),
    });

    const result = await processor.process(
      conv,
      {
        conversationId: "c1",
        clinicId: "clinic1",
        channel: "whatsapp",
        externalThreadId: "+5511999999999",
        phoneNumber: "+5511999999999",
        text: "Oi",
      },
      baseConfig
    );

    assert.equal(result.detectedIntent, "greeting");
    assert.match(result.reply, /Como posso ajudar/);
    assert.doesNotMatch(result.reply, /A vida é uma maravilha/);
  });

  it("random text returns menu not FAQ fallback", async () => {
    const conv = Conversation.openNew({
      id: "c2",
      clinicId: "clinic1",
      channel: "whatsapp",
      externalThreadId: "+5511888888888",
    });
    const processor = new TurnProcessor({
      repository: new MemoryRepo(conv),
      tools: mockTools,
      language: new KeywordLanguageService(),
    });

    const result = await processor.process(
      conv,
      {
        conversationId: "c2",
        clinicId: "clinic1",
        channel: "whatsapp",
        externalThreadId: "+5511888888888",
        phoneNumber: "+5511888888888",
        text: "Eu nao perguntei isso",
      },
      baseConfig
    );

    assert.equal(result.detectedIntent, "unknown");
    assert.doesNotMatch(result.reply, /A vida é uma maravilha/);
  });

  it("faq flow without match shows honest message", async () => {
    const conv = Conversation.openNew({
      id: "c3",
      clinicId: "clinic1",
      channel: "whatsapp",
      externalThreadId: "+5511777777777",
    });
    const processor = new TurnProcessor({
      repository: new MemoryRepo(conv),
      tools: mockTools,
      language: new KeywordLanguageService(),
    });

    const result = await processor.process(
      conv,
      {
        conversationId: "c3",
        clinicId: "clinic1",
        channel: "whatsapp",
        externalThreadId: "+5511777777777",
        phoneNumber: "+5511777777777",
        text: "3",
      },
      baseConfig
    );

    assert.equal(result.detectedIntent, "faq");
    assert.match(result.reply, /Qual sua dúvida/i);
    assert.doesNotMatch(result.reply, /A vida é uma maravilha/);
  });

  it("natural consent grants deferred booking intent", async () => {
    const conv = Conversation.openNew({
      id: "c4",
      clinicId: "clinic1",
      channel: "whatsapp",
      externalThreadId: "+5511666666666",
    });
    conv.requestConsent("booking");
    assert.equal(conv.consent.status, "unknown");

    const processor = new TurnProcessor({
      repository: new MemoryRepo(conv),
      tools: mockTools,
      language: new KeywordLanguageService(),
    });

    const result = await processor.process(
      conv,
      {
        conversationId: "c4",
        clinicId: "clinic1",
        channel: "whatsapp",
        externalThreadId: "+5511666666666",
        phoneNumber: "+5511666666666",
        text: "ok podemos tem o consentimento",
      },
      baseConfig
    );

    assert.equal(result.detectedIntent, "consent.grant");
    assert.equal(conv.consent.status, "granted");
    assert.equal(conv.activeFlow?.kind, "booking");
  });
});
