import { createChatCompletion } from "@/lib/virtual-assistant/openai-client";
import { getOpenAiClinicalModel } from "@/lib/clinical-transcription/feature-flags";

export async function createClinicalJsonCompletion(opts: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const model = getOpenAiClinicalModel();
  const result = await createChatCompletion({
    model,
    temperature: opts.temperature ?? 0.2,
    maxTokens: opts.maxTokens ?? 4000,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
  });

  const content = result.content?.trim();
  if (!content) {
    throw new Error("Resposta vazia da IA clínica.");
  }

  return extractJsonPayload(content);
}

function extractJsonPayload(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = content.indexOf("{");
  const firstBracket = content.indexOf("[");
  const start =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);

  if (start === -1) return content;

  const opener = content[start];
  const closer = opener === "[" ? "]" : "}";
  const end = content.lastIndexOf(closer);
  if (end <= start) return content.slice(start).trim();
  return content.slice(start, end + 1).trim();
}
