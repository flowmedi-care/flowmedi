import type { LanguageService } from "../language/language-service";
import type { ClinicConfig } from "../clinic/clinic-config";
import type { ReplySpec } from "../fsm/side-effects";

const TEMPLATES: Record<string, (vars: Record<string, string>) => string> = {
  "consent.request": () =>
    "Para continuar, precisamos do seu consentimento para uso de dados e mensagens (LGPD). Responda *sim* para aceitar ou *não* para recusar.",
  "menu.main": (vars) =>
    `Olá! Sou ${vars.assistantName ?? "Assistente"}. Como posso ajudar?\n\n1 — Agendar\n2 — Preços\n3 — Dúvidas\n4 — Contato\n5 — Atendente`,
};

export class ReplyRenderer {
  constructor(private readonly language: LanguageService) {}

  async render(
    spec: ReplySpec,
    config: ClinicConfig
  ): Promise<{ text: string; silent: boolean }> {
    if (spec.mode === "silent") {
      return { text: "", silent: true };
    }

    if (spec.mode === "literal") {
      return { text: spec.text, silent: false };
    }

    const vars = { ...spec.vars, assistantName: config.assistantName };
    const templateFn = TEMPLATES[spec.templateId];
    if (templateFn && !config.llmDisabled) {
      return { text: templateFn(vars), silent: false };
    }

    if (spec.mode === "draft" && !config.llmDisabled) {
      const draft = await this.language.draft({
        templateId: spec.templateId,
        vars,
      });
      return { text: draft.text, silent: false };
    }

    if (templateFn) {
      return { text: templateFn(vars), silent: false };
    }

    return { text: "Como posso ajudar?", silent: false };
  }
}
