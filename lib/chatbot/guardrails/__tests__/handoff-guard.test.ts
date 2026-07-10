import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateToolCall } from "../validators";
import { initialAiState } from "../../state/types";
import { extractFacts } from "../../extractors";

describe("transfer_to_human guard with ordinal facts", () => {
  it("blocks handoff when patient says marca qualquer um", () => {
    const facts = extractFacts("marca qualquer um");
    const result = validateToolCall(
      "transfer_to_human",
      { reason: "booking_confusion" },
      { ...initialAiState(), booking: { status: "collecting", procedure_id: "p1" } },
      {},
      facts
    );
    assert.equal(result?.status, "needs_input");
    assert.match(result?.message ?? "", /Continue o agendamento/i);
  });
});
