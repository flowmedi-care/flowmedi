import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createChatCompletion,
  logTokenUsage,
  type ChatMessage,
} from "./openai-client";
import { buildBehaviorInstructions, buildKnowledgeContext } from "./knowledge-context";
import { ASSISTANT_TOOLS, executeAssistantTool } from "./tools";
import type { AiConversationState, VirtualAssistantSettings } from "./types";

const MAX_TOOL_ROUNDS = 5;

const HANDOFF_KEYWORDS = [
  "atendente",
  "humano",
  "pessoa",
  "reclamação",
  "reclamacao",
  "falar com alguém",
  "falar com alguem",
];

export function shouldAutoHandoff(text: string): boolean {
  const lower = text.toLowerCase();
  return HANDOFF_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function runVirtualAssistantAgent(opts: {
  supabase: SupabaseClient;
  clinicId: string;
  conversationId: string;
  phoneNumber: string;
  userMessages: string[];
  settings: Partial<VirtualAssistantSettings>;
  aiState: AiConversationState;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<{ reply: string; handoff?: boolean; statePatch?: Partial<AiConversationState> }> {
  const combinedUserText = opts.userMessages.join("\n").trim();
  if (!combinedUserText) {
    return { reply: "Não consegui entender sua mensagem. Pode repetir?" };
  }

  if (shouldAutoHandoff(combinedUserText) && opts.settings.human_handoff_enabled !== false) {
    const handoffResult = await executeAssistantTool(
      {
        supabase: opts.supabase,
        clinicId: opts.clinicId,
        conversationId: opts.conversationId,
        phoneNumber: opts.phoneNumber,
        aiState: opts.aiState,
      },
      "transfer_to_human",
      { reason: "auto_keyword" }
    );
    return {
      reply: "Claro! Vou chamar alguém da equipe para te atender. Um momento, por favor.",
      handoff: handoffResult.handoff,
    };
  }

  const knowledge = await buildKnowledgeContext(opts.supabase, opts.clinicId);
  const behavior = buildBehaviorInstructions(opts.settings);
  const model = opts.settings.ai_model ?? "gpt-4o-mini";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${knowledge}\n\n${behavior}\n\nEstado atual da conversa: ${JSON.stringify(opts.aiState)}`,
    },
  ];

  const maxHistory = opts.settings.max_context_messages ?? 20;
  for (const h of opts.history.slice(-maxHistory)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: combinedUserText });

  let statePatch: Partial<AiConversationState> = { ...opts.aiState };
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const completion = await createChatCompletion({
      model,
      messages,
      tools: ASSISTANT_TOOLS,
    });
    logTokenUsage(opts.clinicId, completion.usage);

    if (completion.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: completion.content ?? null,
        tool_calls: completion.tool_calls,
      });

      for (const tc of completion.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }

        const toolResult = await executeAssistantTool(
          {
            supabase: opts.supabase,
            clinicId: opts.clinicId,
            conversationId: opts.conversationId,
            phoneNumber: opts.phoneNumber,
            aiState: statePatch as AiConversationState,
          },
          tc.function.name,
          args
        );

        if (toolResult.statePatch) {
          statePatch = { ...statePatch, ...toolResult.statePatch };
        }

        if (toolResult.handoff) {
          return {
            reply:
              completion.content?.trim() ||
              "Transferindo você para nossa equipe. Em breve alguém vai te atender!",
            handoff: true,
            statePatch,
          };
        }

        messages.push({
          role: "tool",
          content: toolResult.result,
          tool_call_id: tc.id,
          name: tc.function.name,
        });
      }
      continue;
    }

    const reply =
      completion.content?.trim() ||
      "Desculpe, não consegui processar. Quer que eu chame um atendente?";
    return { reply, statePatch };
  }

  return {
    reply: "Preciso de mais informações. Pode me contar um pouco mais?",
    statePatch,
  };
}
