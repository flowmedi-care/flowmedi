import type { ActiveFlow } from "./active-flow";
import type { ConsentRecord } from "./consent-record";
import {
  consentWithDeferredIntent as deferIntent,
  deniedConsentRecord,
  emptyConsentRecord,
  grantedConsentRecord,
} from "./consent-record";
import type {
  ClinicId,
  ConversationId,
  ExternalThreadId,
} from "./conversation-id";
import type { ConversationStatus } from "./conversation-status";
import type { HandoffSession } from "./handoff-session";
import type { Channel } from "../shared/channel";
import type { Intent } from "../shared/intent";
import type { PatientRef } from "../shared/patient-ref";
import type { Timestamp } from "../shared/timestamp";
import { nowTimestamp } from "../shared/timestamp";
import type { Version } from "../shared/version";
import type { DomainEvent, DomainEventCollector } from "../events";
import { collectEvent } from "../events";
import { initialBookingDraft, type BookingDraft } from "../booking/booking-draft";
import { initialCrmDraft } from "../crm/crm-draft";
import { initialFaqDraft } from "../faq/faq-draft";
import { initialPricingDraft } from "../pricing/pricing-draft";

export type ConversationProps = {
  id: ConversationId;
  clinicId: ClinicId;
  channel: Channel;
  externalThreadId: ExternalThreadId;
  status: ConversationStatus;
  patientRef: PatientRef | null;
  consent: ConsentRecord;
  handoff: HandoffSession | null;
  activeFlow: ActiveFlow | null;
  version: Version;
  lastUserMessageAt: Timestamp;
};

export class Conversation {
  readonly id: ConversationId;
  readonly clinicId: ClinicId;
  readonly channel: Channel;
  readonly externalThreadId: ExternalThreadId;

  private _status: ConversationStatus;
  private _patientRef: PatientRef | null;
  private _consent: ConsentRecord;
  private _handoff: HandoffSession | null;
  private _activeFlow: ActiveFlow | null;
  private _version: Version;
  private _lastUserMessageAt: Timestamp;
  private _pendingEvents: DomainEventCollector = [];

  private constructor(props: ConversationProps) {
    this.id = props.id;
    this.clinicId = props.clinicId;
    this.channel = props.channel;
    this.externalThreadId = props.externalThreadId;
    this._status = props.status;
    this._patientRef = props.patientRef;
    this._consent = props.consent;
    this._handoff = props.handoff;
    this._activeFlow = props.activeFlow;
    this._version = props.version;
    this._lastUserMessageAt = props.lastUserMessageAt;
    this.assertInvariants();
  }

  static create(props: ConversationProps): Conversation {
    return new Conversation(props);
  }

  static openNew(input: {
    id: ConversationId;
    clinicId: ClinicId;
    channel: Channel;
    externalThreadId: ExternalThreadId;
    at?: Timestamp;
  }): Conversation {
    const at = input.at ?? nowTimestamp();
    return new Conversation({
      id: input.id,
      clinicId: input.clinicId,
      channel: input.channel,
      externalThreadId: input.externalThreadId,
      status: "open",
      patientRef: null,
      consent: emptyConsentRecord(),
      handoff: null,
      activeFlow: null,
      version: 0,
      lastUserMessageAt: at,
    });
  }

  get status(): ConversationStatus {
    return this._status;
  }

  get patientRef(): PatientRef | null {
    return this._patientRef;
  }

  get consent(): ConsentRecord {
    return this._consent;
  }

  get handoff(): HandoffSession | null {
    return this._handoff;
  }

  get activeFlow(): ActiveFlow | null {
    return this._activeFlow;
  }

  get version(): Version {
    return this._version;
  }

  get lastUserMessageAt(): Timestamp {
    return this._lastUserMessageAt;
  }

  pullEvents(): DomainEvent[] {
    const events = this._pendingEvents;
    this._pendingEvents = [];
    return events;
  }

  touchUserMessage(at: Timestamp): void {
    this._lastUserMessageAt = at;
  }

  linkPatient(ref: PatientRef): void {
    this._patientRef = ref;
  }

  clearPatient(): void {
    this._patientRef = null;
  }

  requestConsent(deferredIntent: Intent): void {
    this._status = "awaiting_consent";
    this._consent = deferIntent(deferredIntent);
    this._activeFlow = null;
    this._handoff = null;
    this.assertInvariants();
  }

  grantConsent(at: Timestamp = nowTimestamp()): void {
    this._consent = grantedConsentRecord(at);
    if (this._status === "awaiting_consent") {
      this._status = "open";
    }
    collectEvent(this._pendingEvents, {
      type: "ConsentGranted",
      conversationId: this.id,
      clinicId: this.clinicId,
      patientId: this._patientRef?.id,
    });
    this.assertInvariants();
  }

  denyConsent(at: Timestamp = nowTimestamp()): void {
    this._consent = deniedConsentRecord(at);
    this._status = "open";
    this._activeFlow = null;
    collectEvent(this._pendingEvents, {
      type: "ConsentDenied",
      conversationId: this.id,
      clinicId: this.clinicId,
    });
    this.assertInvariants();
  }

  consumeDeferredIntent(): Intent | null {
    const intent = this._consent.deferredIntent;
    if (intent) {
      this._consent = { ...this._consent, deferredIntent: null };
    }
    return intent;
  }

  startBooking(draft: BookingDraft = initialBookingDraft()): void {
    this._status = "in_flow";
    this._activeFlow = { kind: "booking", draft };
    this._handoff = null;
    collectEvent(this._pendingEvents, {
      type: "BookingFlowStarted",
      conversationId: this.id,
      mode: draft.mode,
    });
    this.assertInvariants();
  }

  startPricing(): void {
    this._status = "in_flow";
    this._activeFlow = { kind: "pricing", draft: initialPricingDraft() };
    this._handoff = null;
    this.assertInvariants();
  }

  startFaq(): void {
    this._status = "in_flow";
    this._activeFlow = { kind: "faq", draft: initialFaqDraft() };
    this._handoff = null;
    this.assertInvariants();
  }

  startCrm(): void {
    this._status = "in_flow";
    this._activeFlow = { kind: "crm", draft: initialCrmDraft() };
    this._handoff = null;
    this.assertInvariants();
  }

  advanceFlow(flow: ActiveFlow): void {
    this._activeFlow = flow;
    if (this._status !== "in_flow") {
      this._status = "in_flow";
    }
    this.assertInvariants();
  }

  completeFlow(summary = ""): void {
    if (this._activeFlow?.kind === "booking") {
      collectEvent(this._pendingEvents, {
        type: "BookingFlowCompleted",
        conversationId: this.id,
        summary,
      });
    }
    this.resetToOpen();
  }

  abortFlow(): void {
    this.resetToOpen();
  }

  enterHandoff(ticketId: string, startedAt: Timestamp = nowTimestamp()): void {
    this._status = "handoff";
    this._handoff = { ticketId, startedAt };
    this._activeFlow = null;
    collectEvent(this._pendingEvents, {
      type: "HandoffRequested",
      conversationId: this.id,
      ticketId,
    });
    this.assertInvariants();
  }

  releaseHandoff(): void {
    this._handoff = null;
    this._status = "open";
    this.assertInvariants();
  }

  close(): void {
    this._status = "closed";
    this._activeFlow = null;
    this._handoff = null;
    collectEvent(this._pendingEvents, {
      type: "ConversationClosed",
      conversationId: this.id,
    });
    this.assertInvariants();
  }

  bumpVersion(): void {
    this._version += 1;
  }

  toProps(): ConversationProps {
    return {
      id: this.id,
      clinicId: this.clinicId,
      channel: this.channel,
      externalThreadId: this.externalThreadId,
      status: this._status,
      patientRef: this._patientRef,
      consent: this._consent,
      handoff: this._handoff,
      activeFlow: this._activeFlow,
      version: this._version,
      lastUserMessageAt: this._lastUserMessageAt,
    };
  }

  private resetToOpen(): void {
    this._status = "open";
    this._activeFlow = null;
    this._handoff = null;
  }

  private assertInvariants(): void {
    if (this._status === "handoff") {
      if (this._activeFlow !== null) {
        throw new Error("Handoff status requires activeFlow to be null");
      }
      if (!this._handoff) {
        throw new Error("Handoff status requires handoff session");
      }
    }
    if (this._status === "in_flow" && this._activeFlow === null) {
      throw new Error("InFlow status requires activeFlow");
    }
    if (this._status === "closed" && (this._activeFlow !== null || this._handoff !== null)) {
      throw new Error("Closed status requires no active flow or handoff");
    }
  }
}
