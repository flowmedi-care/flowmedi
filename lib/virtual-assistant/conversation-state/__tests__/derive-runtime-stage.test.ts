import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveRuntimeStage } from "../derive-runtime-stage";

describe("deriveRuntimeStage", () => {
  it("prioritizes active booking with offered slots", () => {
    const stage = deriveRuntimeStage({
      aiState: {
        booking_step: "slot",
        offered_slots: [{ scheduled_at: "2026-07-10T15:30:00Z", display: "15:30" }],
        procedure_id: "p1",
        doctor_id: "d1",
        pipeline_stage: "captacao",
      },
      detectedIntent: "unknown",
    });
    assert.equal(stage, "agendamento");
  });

  it("uses pending confirmation before CRM journey", () => {
    const stage = deriveRuntimeStage({
      aiState: {
        pending_confirmation_appointment_id: "appt-1",
        journey_step_code: "qualificacao",
      },
      detectedIntent: "unknown",
    });
    assert.equal(stage, "confirmacao_pre_consulta");
  });

  it("maps CRM journey step to pipeline stage", () => {
    const stage = deriveRuntimeStage({
      aiState: { journey_step_code: "orcamento_enviado" },
      detectedIntent: "unknown",
    });
    assert.equal(stage, "orcamento");
  });

  it("does not stick to persisted pipeline_stage", () => {
    const stage = deriveRuntimeStage({
      aiState: {
        pipeline_stage: "agendamento",
        booking_step: "done",
        journey_step_code: "qualificacao",
        patient_id: "pat-1",
      },
      detectedIntent: "unknown",
      patientFound: true,
    });
    assert.equal(stage, "captacao");
  });
});
