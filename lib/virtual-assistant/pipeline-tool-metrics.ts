import type { SupabaseClient } from "@supabase/supabase-js";

export type PipelineToolMetricRow = {
  pipeline_stage: string | null;
  tool_name: string;
  total: number;
  success_count: number;
  block_count: number;
  success_rate: number;
};

export async function gatherPipelineToolMetrics(
  supabase: SupabaseClient,
  clinicId: string,
  sinceDays = 30
): Promise<PipelineToolMetricRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const { data, error } = await supabase
    .from("whatsapp_ai_tool_log")
    .select("pipeline_stage, tool_name, success, block_reason, created_at")
    .eq("clinic_id", clinicId)
    .gte("created_at", since.toISOString())
    .limit(5000);

  if (error?.message?.includes("pipeline_stage")) {
    const fallback = await supabase
      .from("whatsapp_ai_tool_log")
      .select("tool_name, success, created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", since.toISOString())
      .limit(5000);
    if (fallback.error || !fallback.data?.length) return [];
    const buckets = new Map<string, { total: number; success: number; blocks: number }>();
    for (const row of fallback.data) {
      const key = `unknown::${row.tool_name}`;
      const cur = buckets.get(key) ?? { total: 0, success: 0, blocks: 0 };
      cur.total++;
      if (row.success) cur.success++;
      buckets.set(key, cur);
    }
    return [...buckets.entries()].map(([key, v]) => {
      const [, tool_name] = key.split("::");
      return {
        pipeline_stage: null,
        tool_name,
        total: v.total,
        success_count: v.success,
        block_count: v.blocks,
        success_rate: v.total > 0 ? Math.round((v.success / v.total) * 100) : 0,
      };
    });
  }

  if (error || !data?.length) return [];

  const buckets = new Map<string, { total: number; success: number; blocks: number }>();

  for (const row of data) {
    const stage = row.pipeline_stage ?? "unknown";
    const key = `${stage}::${row.tool_name}`;
    const cur = buckets.get(key) ?? { total: 0, success: 0, blocks: 0 };
    cur.total++;
    if (row.success) cur.success++;
    if (row.block_reason) cur.blocks++;
    buckets.set(key, cur);
  }

  return [...buckets.entries()]
    .map(([key, v]) => {
      const [pipeline_stage, tool_name] = key.split("::");
      return {
        pipeline_stage: pipeline_stage === "unknown" ? null : pipeline_stage,
        tool_name,
        total: v.total,
        success_count: v.success,
        block_count: v.blocks,
        success_rate: v.total > 0 ? Math.round((v.success / v.total) * 100) : 0,
      };
    })
    .sort((a, b) => b.block_count - a.block_count || b.total - a.total);
}
