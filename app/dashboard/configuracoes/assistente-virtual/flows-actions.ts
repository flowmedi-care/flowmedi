"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";
import type { ConversationFlowsConfig, WorkflowDefinition } from "@/lib/attendance-flow/types";
import { mergeConversationFlows } from "@/lib/attendance-flow/defaults";

async function requireAdminClinic() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", clinicId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Apenas administradores.", clinicId: null };
  }

  return { error: null, clinicId: profile.clinic_id };
}

export async function saveConversationFlows(workflows: Record<string, WorkflowDefinition>) {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error };

  const serviceSupabase = createServiceRoleClient();
  const merged = mergeConversationFlows({ workflows });

  const { error } = await serviceSupabase
    .from("clinic_virtual_assistant_settings")
    .upsert(
      {
        clinic_id: ctx.clinicId,
        conversation_flows: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id" }
    );

  if (error) return { error: error.message };
  revalidatePath("/dashboard/configuracoes/assistente-virtual");
  return { error: null };
}

export async function getConversationFlowsConfig(): Promise<ConversationFlowsConfig> {
  const ctx = await requireAdminClinic();
  if (ctx.error || !ctx.clinicId) return mergeConversationFlows(null);

  const serviceSupabase = createServiceRoleClient();
  const { data } = await serviceSupabase
    .from("clinic_virtual_assistant_settings")
    .select("conversation_flows")
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();

  return mergeConversationFlows(
    data?.conversation_flows as Partial<ConversationFlowsConfig> | null
  );
}
