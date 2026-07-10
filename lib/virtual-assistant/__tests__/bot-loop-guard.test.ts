import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkBotLoopRisk,
  freshBotLoopWindowState,
  resolveBotLoopWindowSince,
} from "../bot-loop-guard";
import type { AiConversationState } from "../types";

function createBotLoopMockSupabase(opts: {
  outboundCount: number;
  inboundContents?: string[];
}) {
  const capturedSince: string[] = [];

  const outboundResult = async () => ({
    data: Array.from({ length: opts.outboundCount }, (_, i) => ({
      id: `out-${i}`,
      sent_at: new Date().toISOString(),
    })),
  });

  const inboundResult = async () => ({
    data: (opts.inboundContents ?? []).map((content) => ({ content })),
  });

  const supabase = {
    from: () => ({
      select: () => {
        let direction: string | null = null;
        const chain = {
          eq: (_col: string, val: string) => {
            if (val === "outbound" || val === "inbound") {
              direction = val;
            }
            return chain;
          },
          gte: (_c: string, since: string) => {
            capturedSince.push(since);
            if (direction === "outbound") {
              return {
                not: () => ({
                  order: outboundResult,
                }),
              };
            }
            return {
              order: () => ({
                limit: inboundResult,
              }),
            };
          },
        };
        return chain;
      },
    }),
  };

  return { supabase, capturedSince };
}

describe("resolveBotLoopWindowSince", () => {
  it("usa defaultSinceMs quando não há reset", () => {
    const defaultSinceMs = Date.now() - 10 * 60 * 1000;
    const result = resolveBotLoopWindowSince(defaultSinceMs);
    assert.equal(result, new Date(defaultSinceMs).toISOString());
  });

  it("usa bot_loop_window_since quando mais recente que a janela padrão", () => {
    const defaultSinceMs = Date.now() - 10 * 60 * 1000;
    const resetAt = new Date().toISOString();
    const result = resolveBotLoopWindowSince(defaultSinceMs, {
      bot_loop_window_since: resetAt,
    });
    assert.equal(result, resetAt);
  });

  it("mantém janela padrão quando reset é mais antigo", () => {
    const defaultSinceMs = Date.now() - 10 * 60 * 1000;
    const oldReset = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const result = resolveBotLoopWindowSince(defaultSinceMs, {
      bot_loop_window_since: oldReset,
    });
    assert.equal(result, new Date(defaultSinceMs).toISOString());
  });
});

describe("freshBotLoopWindowState", () => {
  it("retorna bot_loop_window_since em ISO", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const state = freshBotLoopWindowState(now);
    assert.equal(state.bot_loop_window_since, "2026-07-10T12:00:00.000Z");
  });
});

describe("checkBotLoopRisk", () => {
  it("bloqueia com high_outbound_rate quando há 5+ outbound sem reset", async () => {
    const { supabase } = createBotLoopMockSupabase({ outboundCount: 5 });
    const result = await checkBotLoopRisk(
      supabase as never,
      "conv-1",
      "clinic-1",
      "Oi"
    );
    assert.equal(result.block, true);
    assert.equal(result.reason, "high_outbound_rate");
  });

  it("não bloqueia Oi após reset recente da janela (outbound antigos ignorados)", async () => {
    const { supabase, capturedSince } = createBotLoopMockSupabase({ outboundCount: 0 });
    const aiState: AiConversationState = freshBotLoopWindowState();
    const result = await checkBotLoopRisk(
      supabase as never,
      "conv-1",
      "clinic-1",
      "Oi",
      aiState
    );
    assert.equal(result.block, false);
    assert.ok(capturedSince.length >= 1);
    assert.equal(capturedSince[0], aiState.bot_loop_window_since);
  });

  it("bloqueia quando há 5+ outbound após o reset", async () => {
    const { supabase } = createBotLoopMockSupabase({ outboundCount: 5 });
    const aiState: AiConversationState = {
      bot_loop_window_since: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    };
    const result = await checkBotLoopRisk(
      supabase as never,
      "conv-1",
      "clinic-1",
      "Oi",
      aiState
    );
    assert.equal(result.block, true);
    assert.equal(result.reason, "high_outbound_rate");
  });
});
