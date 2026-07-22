import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOperationalProjection } from "../project";
import type { JourneyCase } from "@/lib/case-management/types";

function baseCase(over: Partial<JourneyCase> & { id: string }): JourneyCase {
  return {
    clinic_id: "c1",
    contact_id: "lead:1",
    lead_id: "l1",
    patient_id: "p1",
    process_type_id: "pt1",
    workflow_version_id: null,
    phase_id: "ph1",
    owner_type: "human",
    owner_id: null,
    owner: "human",
    pending_decision: null,
    execution_context: null,
    status: "active",
    opened_at: "2026-01-01T00:00:00Z",
    closed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    journey_type: "primeira_consulta",
    phase: "comercial",
    ...over,
  };
}

describe("buildOperationalProjection", () => {
  it("groups work by next_decision and keeps one card per case", () => {
    const now = new Date("2026-07-22T12:00:00");
    const cases = [
      baseCase({
        id: "case-a",
        pending_decision: {
          type: "confirm_slot",
          waiting_for: "secretaria",
          label: "Confirmar consulta",
        },
      }),
      baseCase({
        id: "case-b",
        patient_id: "p2",
        lead_id: "l2",
        pending_decision: {
          type: "confirm_slot",
          waiting_for: "secretaria",
          label: "Confirmar consulta",
        },
      }),
      baseCase({
        id: "case-c",
        patient_id: "p3",
        process_type_id: "pt-trat",
        journey_type: "tratamento",
        phase: "sessoes",
        pending_decision: null,
      }),
    ];

    const projection = buildOperationalProjection({
      cases,
      appointments: [
        {
          id: "a1",
          status: "agendada",
          scheduled_at: "2026-07-22T15:00:00.000Z",
          patient_id: "p1",
        },
      ],
      names: {
        byPatientId: { p1: "Maria", p2: "João", p3: "Ana" },
        byLeadId: {},
        phaseCodeById: { ph1: "comercial" },
        processCodeById: { pt1: "primeira_consulta", "pt-trat": "tratamento" },
      },
      now,
    });

    assert.equal(projection.items.length, 3);
    assert.equal(projection.workToday.pendingCount, 2);
    assert.equal(projection.workToday.byAction[0]?.action, "confirm_slot");
    assert.equal(projection.workToday.byAction[0]?.count, 2);
    assert.ok(projection.pendencias.every((p) => p.nextDecision != null));
    assert.ok(projection.atencao.every((p) => p.nextDecision != null));
    assert.equal(projection.panorama.pacientes.tratamento, 1);
    assert.ok(projection.items.every((i) => i.journey && i.stage && i.context));
    assert.equal(projection.items.find((i) => i.caseId === "case-a")?.panoramaSlice, "atendimentos");
  });
});
