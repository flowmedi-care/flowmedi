import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMessageFlows } from "../diagnostics-flow";
import type { AiEventRow } from "../diagnostics";

function event(
  partial: Partial<AiEventRow> & Pick<AiEventRow, "id" | "stage" | "created_at">
): AiEventRow {
  return {
    level: "info",
    detail: {},
    conversation_id: "conv-1",
    message_id: null,
    ...partial,
  };
}

describe("buildMessageFlows", () => {
  it("builds flows from webhook_inbound anchor", () => {
    const events: AiEventRow[] = [
      event({
        id: "a1",
        stage: "webhook_inbound",
        created_at: "2026-07-10T10:00:00.000Z",
        detail: { from: "5562996915034", bodyPreview: "Oi" },
      }),
      event({
        id: "e1",
        stage: "reply_sent",
        created_at: "2026-07-10T10:00:05.000Z",
        detail: { replyPreview: "Olá!" },
      }),
    ];

    const flows = buildMessageFlows(events, {});
    assert.equal(flows.length, 1);
    assert.match(flows[0].messagePreview, /Oi/);
    assert.equal(flows[0].status, "completed");
  });

  it("builds synthetic flows when only pending_messages exist", () => {
    const events: AiEventRow[] = [
      event({
        id: "cron-1",
        stage: "cron_conversation_processed",
        created_at: "2026-07-10T10:00:00.000Z",
        detail: { source: "cron" },
      }),
      event({
        id: "p1",
        stage: "pending_messages",
        created_at: "2026-07-10T10:00:01.000Z",
        detail: { count: 1, preview: ["Oi"] },
      }),
      event({
        id: "r1",
        stage: "reply_sent",
        created_at: "2026-07-10T10:00:06.000Z",
        detail: { replyPreview: "Menu" },
      }),
    ];

    const flows = buildMessageFlows(events, {});
    assert.equal(flows.length, 1);
    assert.match(flows[0].messagePreview, /Oi/);
  });
});
