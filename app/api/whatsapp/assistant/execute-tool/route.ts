import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ASSISTANT_TOOL_NAMES } from "@/lib/virtual-assistant/tools/definitions";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import { normalizeAiState } from "@/lib/chatbot/state/migrate";
import { initialAiState } from "@/lib/chatbot/state/types";
import { mergeAiState, patchAiState } from "@/lib/chatbot/state/patch";
import { executeTool } from "@/lib/chatbot/tools/execute";
import { isChatbotTool } from "@/lib/chatbot/tools/definitions";
import type { ToolResult } from "@/lib/chatbot/tools/types";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";

const MUTATING_TOOLS = new Set([
  "register_patient",
  "create_appointment",
  "confirm_appointment",
  "cancel_appointment",
  "reschedule_appointment",
  "create_and_send_quote",
  "resend_form_link",
  "collect_nps_feedback",
  "transfer_to_human",
]);

function extractWarnings(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const r = result as ToolResult;
  const warnings: string[] = [];
  if (r.message) warnings.push(r.message);
  if (r.suggestion) warnings.push(`Sugestão: ${r.suggestion}`);
  if (r.missing?.length) {
    warnings.push(`Campos faltando: ${r.missing.map((m) => m.field).join(", ")}`);
  }
  if (r.status && r.status !== "success") {
    warnings.push(`Status: ${r.status}`);
  }
  return warnings;
}

function mergeConversationState(
  before: Record<string, unknown>,
  patch: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!patch || !Object.keys(patch).length) return before;
  const normalizedBefore = normalizeAiState(before);
  const normalizedPatch = normalizeAiState(patch);
  const merged = mergeAiState(normalizedBefore, normalizedPatch);
  const legacyKeys = [
    "booking_step",
    "doctor_id",
    "procedure_id",
    "service_id",
    "pending_slot",
    "offered_slots",
    "offered_days",
    "journey_step_code",
    "last_created_appointment_id",
    "dimension_value_ids",
    "intent",
    "pipeline_stage",
  ] as const;
  const next: Record<string, unknown> = { ...before, ...merged };
  for (const key of legacyKeys) {
    if (key in patch) next[key] = patch[key];
  }
  return next;
}

/**
 * POST /api/whatsapp/assistant/execute-tool
 * Body: { toolName, args?, phone, conversationId?, aiState?, confirmMutating?, executorMode?, debug? }
 */
export async function POST(request: NextRequest) {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const body = (await request.json()) as {
      toolName?: string;
      args?: Record<string, unknown>;
      phone?: string;
      conversationId?: string;
      aiState?: AiConversationState;
      confirmMutating?: boolean;
      executorMode?: "production" | "full";
      debug?: boolean;
    };

    const toolName = String(body.toolName ?? "").trim();
    if (!toolName) {
      return NextResponse.json({ error: "toolName é obrigatório" }, { status: 400 });
    }
    if (!ASSISTANT_TOOL_NAMES.includes(toolName)) {
      return NextResponse.json({ error: `Ferramenta desconhecida: ${toolName}` }, { status: 400 });
    }

    const executorMode = body.executorMode ?? "full";
    if (executorMode === "production" && !isChatbotTool(toolName)) {
      return NextResponse.json(
        {
          error: `"${toolName}" não está disponível no modo produção. Use modo completo (VA) ou escolha uma das 12 ferramentas do chatbot.`,
        },
        { status: 400 }
      );
    }

    const phoneRaw = String(body.phone ?? "").trim();
    if (!phoneRaw) {
      return NextResponse.json({ error: "phone é obrigatório" }, { status: 400 });
    }

    if (MUTATING_TOOLS.has(toolName) && !body.confirmMutating) {
      return NextResponse.json(
        {
          error: "Esta ferramenta altera dados reais. Envie confirmMutating: true para executar.",
          requiresConfirmation: true,
        },
        { status: 400 }
      );
    }

    const phone = normalizeWhatsAppPhone(phoneRaw.replace(/\D/g, ""));
    const args = body.args ?? {};
    const aiStateBefore = body.aiState
      ? (body.aiState as Record<string, unknown>)
      : (initialAiState() as Record<string, unknown>);
    const aiStateNormalized = normalizeAiState(aiStateBefore);

    const supabase = createServiceRoleClient();

    let conversationId = body.conversationId?.trim() || "";
    if (conversationId) {
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (!conv?.id) {
        return NextResponse.json({ error: "Conversa não encontrada nesta clínica" }, { status: 404 });
      }
    } else {
      const { data: existing } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("phone_number", phone)
        .maybeSingle();

      if (existing?.id) {
        conversationId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from("whatsapp_conversations")
          .insert({
            clinic_id: clinicId,
            phone_number: phone,
            status: "open",
          })
          .select("id")
          .single();
        if (createErr || !created?.id) {
          return NextResponse.json(
            { error: createErr?.message ?? "Falha ao criar conversa de teste" },
            { status: 500 }
          );
        }
        conversationId = created.id;
      }
    }

    const startedAt = Date.now();
    let parsedResult: unknown;
    let handoff = false;
    let statePatch: Record<string, unknown> | null = null;
    let implicitPatch: Record<string, unknown> | null = null;
    let rawResult: string | undefined;
    let listExecutionTraceFromOutcome:
      | import("@/lib/virtual-assistant/services/list-appointments-trace").ListExecutionTrace
      | undefined;

    if (executorMode === "production") {
      const [{ data: settingsRow }, { data: faqRows }] = await Promise.all([
        supabase.from("clinic_virtual_assistant_settings").select("*").eq("clinic_id", clinicId).maybeSingle(),
        supabase
          .from("clinic_virtual_assistant_faq")
          .select("id, question, answer")
          .eq("clinic_id", clinicId)
          .order("display_order"),
      ]);

      const outcome = await executeTool(
        {
          supabase,
          clinicId,
          conversationId,
          phoneNumber: phone,
          aiState: aiStateNormalized,
          settings: (settingsRow ?? {}) as Partial<import("@/lib/virtual-assistant/types").VirtualAssistantSettings>,
          faqs: (faqRows ?? []).map((f) => ({
            id: f.id,
            question: f.question,
            answer: f.answer,
          })),
        },
        toolName,
        args
      );

      parsedResult = outcome.result;
      handoff = outcome.handoff ?? false;
      rawResult = JSON.stringify(outcome.result);
      listExecutionTraceFromOutcome = outcome.listExecutionTrace;

      const explicitPatch = outcome.statePatch ?? {};
      implicitPatch = patchAiState(toolName, args, outcome.result, aiStateNormalized);
      statePatch = { ...explicitPatch, ...implicitPatch };
    } else {
      const toolResult = await executeAssistantTool(
        {
          supabase,
          clinicId,
          conversationId,
          phoneNumber: phone,
          aiState: aiStateNormalized as AiConversationState,
        },
        toolName,
        args
      );

      rawResult = toolResult.result;
      try {
        parsedResult = JSON.parse(toolResult.result);
      } catch {
        parsedResult = toolResult.result;
      }
      handoff = toolResult.handoff ?? false;
      statePatch = (toolResult.statePatch as Record<string, unknown>) ?? null;
    }

    const durationMs = Date.now() - startedAt;
    const aiStateAfter = mergeConversationState(aiStateBefore, statePatch);

    let toolLogId: string | undefined;
    if (body.debug !== false) {
      const { data: logRow } = await supabase
        .from("whatsapp_ai_tool_log")
        .select("id, params, result_summary, success, pipeline_stage")
        .eq("clinic_id", clinicId)
        .eq("conversation_id", conversationId)
        .eq("tool_name", toolName)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      toolLogId = logRow?.id;
    }

    const warnings = extractWarnings(parsedResult);
    const debugEnabled = body.debug !== false;

    return NextResponse.json({
      ok: true,
      toolName,
      conversationId,
      phone,
      durationMs,
      result: parsedResult,
      rawResult,
      handoff,
      statePatch,
      ...(debugEnabled && {
        debug: {
          executorMode,
          argsSent: args,
          aiStateBefore,
          aiStateAfter,
          implicitPatch: implicitPatch ?? undefined,
          toolLogId,
          warnings,
          httpStatus: 200,
          ...(listExecutionTraceFromOutcome
            ? { listExecutionTrace: listExecutionTraceFromOutcome }
            : {}),
        },
      }),
    });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return toApiErrorResponse(e);
    }
    const message = e instanceof Error ? e.message : "Erro ao executar ferramenta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
