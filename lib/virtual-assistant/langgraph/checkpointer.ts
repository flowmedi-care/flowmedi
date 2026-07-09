import { MemorySaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import type { BaseCheckpointSaver } from "@langchain/langgraph";

let checkpointerInstance: BaseCheckpointSaver | null = null;
let setupPromise: Promise<void> | null = null;

export function getLangGraphDatabaseUrl(): string | null {
  return (
    process.env.LANGGRAPH_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.SUPABASE_DATABASE_URL ??
    null
  );
}

export async function getCheckpointer(): Promise<BaseCheckpointSaver> {
  if (checkpointerInstance) return checkpointerInstance;

  const connString = getLangGraphDatabaseUrl();
  if (connString) {
    const pgSaver = PostgresSaver.fromConnString(connString, { schema: "public" });
    setupPromise = pgSaver.setup();
    await setupPromise;
    checkpointerInstance = pgSaver;
    return pgSaver;
  }

  checkpointerInstance = new MemorySaver();
  return checkpointerInstance;
}

export function resetCheckpointerForTests(): void {
  checkpointerInstance = null;
  setupPromise = null;
}
