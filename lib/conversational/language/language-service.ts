import type { Intent } from "../domain/shared/intent";

export type ExtractRequest = {
  text: string;
  allowedIntents: Intent[];
};

export type ExtractResult = {
  intent: Intent;
  confidence: number;
  entities: Array<{ name: string; value: string }>;
};

export type DraftRequest = {
  templateId: string;
  vars: Record<string, string>;
  tone?: string;
};

export type DraftResult = {
  text: string;
};

export interface LanguageService {
  extract(request: ExtractRequest): Promise<ExtractResult>;
  draft(request: DraftRequest): Promise<DraftResult>;
}

export class KeywordLanguageService implements LanguageService {
  async extract(request: ExtractRequest): Promise<ExtractResult> {
    const lower = request.text.toLowerCase();
    let intent: Intent = "unknown";
    if (/agendar|marcar|consulta/.test(lower)) intent = "booking";
    else if (/preço|preco|valor|quanto/.test(lower)) intent = "pricing";
    else if (/atendente|humano/.test(lower)) intent = "handoff";
    else if (/cadastr|interesse/.test(lower)) intent = "crm";
    else if (/dúvida|duvida|informação|informacao|faq/.test(lower)) intent = "faq";

    if (!request.allowedIntents.includes(intent)) {
      intent = "unknown";
    }

    return { intent, confidence: intent === "unknown" ? 0.3 : 0.85, entities: [] };
  }

  async draft(request: DraftRequest): Promise<DraftResult> {
    const parts = Object.entries(request.vars)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    return {
      text: `[${request.templateId}]\n${parts}`.trim(),
    };
  }
}

export const defaultLanguageService = new KeywordLanguageService();
