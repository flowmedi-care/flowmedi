import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ASSISTANT_TOOL_NAMES } from "@/lib/virtual-assistant/tools/definitions";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { AiConversationState } from "@/lib/virtual-assistant/types";
import { normalizeAiState } from "@/lib/chatbot/state/migrate";
import { initialAiState } from "@/lib/chatbot/state/types";
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

/**
 * POST /api/whatsapp/assistant/execute-tool
 * Body: { toolName, args?, phone, conversationId?, aiState?, confirmMutating? }
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
    };

    const toolName = String(body.toolName ?? "").trim();
    if (!toolName) {
      return NextResponse.json({ error: "toolName é obrigatório" }, { status: 400 });
    }
    if (!ASSISTANT_TOOL_NAMES.includes(toolName)) {
      return NextResponse.json({ error: `Ferramenta desconhecida: ${toolName}` }, { status: 400 });
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
    const aiState: AiConversationState = body.aiState
      ? normalizeAiState(body.aiState as Record<string, unknown>)
      : initialAiState();

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
    const toolResult = await executeAssistantTool(
      {
        supabase,
        clinicId,
        conversationId,
        phoneNumber: phone,
        aiState,
      },
      toolName,
      args
    );

    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(toolResult.result);
    } catch {
      parsedResult = toolResult.result;
    }

    return NextResponse.json({
      ok: true,
      toolName,
      conversationId,
      phone,
      durationMs: Date.now() - startedAt,
      result: parsedResult,
      rawResult: toolResult.result,
      handoff: toolResult.handoff ?? false,
      statePatch: toolResult.statePatch ?? null,
    });
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return toApiErrorResponse(e);
    }
    const message = e instanceof Error ? e.message : "Erro ao executar ferramenta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
