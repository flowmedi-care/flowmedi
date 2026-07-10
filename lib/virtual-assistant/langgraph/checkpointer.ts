export async function getCheckpointer() {
  return {
    deleteThread: async (_threadId: string) => {},
  };
}

export function getCheckpointerRuntimeStatus(): {
  mode: "memory";
  error: string | null;
  initError: string | null;
  dbConfigured: boolean;
  dbHost: string | null;
  directDbHostWarning: boolean;
  usesDirectSupabaseHost: boolean;
} {
  return {
    mode: "memory",
    error: null,
    initError: null,
    dbConfigured: false,
    dbHost: null,
    directDbHostWarning: false,
    usesDirectSupabaseHost: false,
  };
}
