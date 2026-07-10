import type { ToolName } from "./registry";
import { isToolAllowed, TOOL_REGISTRY } from "./registry";

export type ToolCall = {
  name: ToolName;
  args: Record<string, unknown>;
  idempotencyKey?: string;
};

export type ToolContext = {
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  domain: string;
  fsmState: string;
  turnId: string;
};

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; recoverable?: boolean };

export type ToolExecutor = (
  call: ToolCall,
  ctx: ToolContext
) => Promise<ToolResult>;

export class ToolGateway {
  private readonly cache = new Map<string, { at: number; data: unknown }>();

  constructor(private readonly executors: Partial<Record<ToolName, ToolExecutor>>) {}

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const def = TOOL_REGISTRY[call.name];
    if (!def) {
      return { ok: false, error: `Unknown tool: ${call.name}`, recoverable: false };
    }

    if (!isToolAllowed(ctx.domain, ctx.fsmState, call.name)) {
      return {
        ok: false,
        error: `Tool ${call.name} not allowed for ${ctx.domain}@${ctx.fsmState}`,
        recoverable: false,
      };
    }

    if (def.kind === "command" && !call.idempotencyKey) {
      return {
        ok: false,
        error: `Command ${call.name} requires idempotencyKey`,
        recoverable: false,
      };
    }

    if (def.kind === "query" && def.cacheTtlMs) {
      const cacheKey = `${ctx.clinicId}:${call.name}:${JSON.stringify(call.args)}`;
      const hit = this.cache.get(cacheKey);
      if (hit && Date.now() - hit.at < def.cacheTtlMs) {
        return { ok: true, data: hit.data };
      }
    }

    const executor = this.executors[call.name];
    if (!executor) {
      return { ok: false, error: `No executor for ${call.name}`, recoverable: true };
    }

    const result = await executor(call, ctx);
    if (result.ok && def.kind === "query" && def.cacheTtlMs) {
      const cacheKey = `${ctx.clinicId}:${call.name}:${JSON.stringify(call.args)}`;
      this.cache.set(cacheKey, { at: Date.now(), data: result.data });
    }
    return result;
  }
}
