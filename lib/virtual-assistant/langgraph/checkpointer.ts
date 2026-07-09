import { MemorySaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import type { BaseCheckpointSaver } from "@langchain/langgraph";

let checkpointerInstance: BaseCheckpointSaver | null = null;
let checkpointerMode: "postgres" | "memory" = "memory";
let checkpointerInitError: string | null = null;

export function getLangGraphDatabaseUrl(): string | null {
  return (
    process.env.LANGGRAPH_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.SUPABASE_DATABASE_URL ??
    null
  );
}

/** Host da connection string (sem credenciais) — útil para diagnóstico. */
export function getLangGraphDatabaseHost(): string | null {
  const url = getLangGraphDatabaseUrl();
  if (!url) return null;
  try {
    return new URL(url.replace(/^postgresql:\/\//, "https://")).hostname;
  } catch {
    return null;
  }
}

export function getCheckpointerRuntimeStatus(): {
  mode: "postgres" | "memory";
  dbConfigured: boolean;
  dbHost: string | null;
  initError: string | null;
  usesDirectSupabaseHost: boolean;
} {
  const dbHost = getLangGraphDatabaseHost();
  return {
    mode: checkpointerMode,
    dbConfigured: Boolean(getLangGraphDatabaseUrl()),
    dbHost,
    initError: checkpointerInitError,
    usesDirectSupabaseHost: Boolean(dbHost?.startsWith("db.") && dbHost.includes("supabase.co")),
  };
}

export async function getCheckpointer(): Promise<BaseCheckpointSaver> {
  if (checkpointerInstance) return checkpointerInstance;

  const connString = getLangGraphDatabaseUrl();
  if (connString) {
    try {
      const pgSaver = PostgresSaver.fromConnString(connString, { schema: "public" });
      await pgSaver.setup();
      checkpointerInstance = pgSaver;
      checkpointerMode = "postgres";
      checkpointerInitError = null;
      return pgSaver;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      checkpointerInitError = message;
      console.warn(
        "[LangGraph] Postgres checkpointer indisponível, usando MemorySaver:",
        message
      );
    }
  }

  checkpointerInstance = new MemorySaver();
  checkpointerMode = "memory";
  return checkpointerInstance;
}

export function resetCheckpointerForTests(): void {
  checkpointerInstance = null;
  checkpointerInitError = null;
  checkpointerMode = "memory";
}
