import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampMessagesLimit,
  encodeMessageCursor,
  parseMessageCursor,
} from "../message-cursor";

describe("message-cursor", () => {
  it("encodes and parses composite cursor", () => {
    const sentAt = "2026-07-22T13:30:10.123Z";
    const id = "3fbca000-0000-4000-8000-000000000001";
    const cursor = encodeMessageCursor(sentAt, id);
    assert.equal(cursor, `${sentAt}|${id}`);
    assert.deepEqual(parseMessageCursor(cursor), { sentAt, id });
  });

  it("rejects invalid cursors", () => {
    assert.equal(parseMessageCursor(null), null);
    assert.equal(parseMessageCursor(""), null);
    assert.equal(parseMessageCursor("no-pipe"), null);
    assert.equal(parseMessageCursor("|only-id"), null);
    assert.equal(parseMessageCursor("not-a-date|uuid"), null);
  });

  it("clamps limit", () => {
    assert.equal(clampMessagesLimit(null), 50);
    assert.equal(clampMessagesLimit("10"), 10);
    assert.equal(clampMessagesLimit("999"), 100);
    assert.equal(clampMessagesLimit("0"), 50);
  });
});
