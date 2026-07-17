import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildOperationsSnapshot } from "../operations-snapshot";
import { resolveOperationsOwner, computeSla } from "../resolve-owner";
import type { ConversationOpsRow } from "../types";

function baseRow(over: Partial<ConversationOpsRow> = {}): ConversationOpsRow {
  return {
    id: "c1",
    clinic_id: "clinic1",
    phone_number: "5511999999999",
    contact_name: "Maria",
    status: "open",
    ai_enabled: true,
    ai_handoff_at: null,
    ai_user_opt_out: false,
    assigned_secretary_id: null,
    ...over,
  };
}

describe("resolveOperationsOwner", () => {
  it("returns ai when flags allow and no assignee", () => {
    const r = resolveOperationsOwner(baseRow());
    assert.equal(r.owner, "ai");
    assert.equal(r.ownerUserId, null);
  });

  it("returns human when handoff set", () => {
    const r = resolveOperationsOwner(
      baseRow({ ai_handoff_at: new Date().toISOString(), ai_enabled: false })
    );
    assert.equal(r.owner, "human");
  });

  it("returns human with assignee", () => {
    const r = resolveOperationsOwner(
      baseRow({
        assigned_secretary_id: "u1",
        ai_enabled: false,
        ai_handoff_at: new Date().toISOString(),
      })
    );
    assert.equal(r.owner, "human");
    assert.equal(r.ownerUserId, "u1");
  });

  it("prefers native ops_owner_type", () => {
    const r = resolveOperationsOwner(
      baseRow({
        ops_owner_type: "system",
        ops_owner_user_id: null,
        ai_enabled: true,
      })
    );
    assert.equal(r.owner, "system");
  });

  it("opt-out forces human", () => {
    const r = resolveOperationsOwner(baseRow({ ai_user_opt_out: true }));
    assert.equal(r.owner, "human");
  });
});

describe("buildOperationsSnapshot", () => {
  it("builds ai snapshot with canCompose false for viewer", () => {
    const snap = buildOperationsSnapshot(baseRow(), {
      assistantName: "Luna",
      viewerUserId: "u1",
    });
    assert.equal(snap.owner, "ai");
    assert.equal(snap.ownerLabel, "Luna");
    assert.equal(snap.canCompose, false);
    assert.equal(snap.aiEnabled, true);
  });

  it("allows compose when viewer is owner human", () => {
    const snap = buildOperationsSnapshot(
      baseRow({
        ops_owner_type: "human",
        ops_owner_user_id: "u1",
        assigned_secretary_id: "u1",
        ai_enabled: false,
        ai_handoff_at: new Date().toISOString(),
      }),
      { assignedSecretaryName: "Ana", viewerUserId: "u1" }
    );
    assert.equal(snap.owner, "human");
    assert.equal(snap.ownerLabel, "Ana");
    assert.equal(snap.canCompose, true);
  });

  it("blocks compose when another human owns", () => {
    const snap = buildOperationsSnapshot(
      baseRow({
        ops_owner_type: "human",
        ops_owner_user_id: "u2",
        assigned_secretary_id: "u2",
        ai_enabled: false,
        ai_handoff_at: new Date().toISOString(),
      }),
      { assignedSecretaryName: "Maria", viewerUserId: "u1" }
    );
    assert.equal(snap.canCompose, false);
    assert.equal(snap.conductorLabel, "Maria");
  });

  it("blocks compose for human pool until claim", () => {
    const snap = buildOperationsSnapshot(
      baseRow({
        ops_owner_type: "human",
        ops_owner_user_id: null,
        assigned_secretary_id: null,
        ai_enabled: false,
        ai_handoff_at: new Date().toISOString(),
      }),
      { viewerUserId: "u1" }
    );
    assert.equal(snap.canCompose, false);
  });

  it("uses persisted pendingDecision", () => {
    const snap = buildOperationsSnapshot(
      baseRow({
        pending_decision: {
          type: "confirm",
          label: "Confirmar consulta",
          owner: "patient_waiting",
          priority: "high",
          dueAt: null,
          source: "appointment",
          status: "pending",
          actions: [],
        },
      })
    );
    assert.equal(snap.pendingDecision?.label, "Confirmar consulta");
    assert.equal(snap.pendingDecision?.priority, "high");
  });
});

describe("computeSla", () => {
  it("breaches after 15 minutes for human", () => {
    const handoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const sla = computeSla({
      owner: "human",
      aiHandoffAt: handoff,
      assignedAt: null,
    });
    assert.equal(sla.breached, true);
    assert.ok((sla.secondsRemaining ?? 0) < 0);
  });

  it("no sla for ai owner", () => {
    const sla = computeSla({
      owner: "ai",
      aiHandoffAt: null,
      assignedAt: null,
    });
    assert.equal(sla.dueAt, null);
    assert.equal(sla.breached, false);
  });
});
