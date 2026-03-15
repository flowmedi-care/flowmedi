"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  createClinicMetaMessageModel,
  deleteClinicMetaMessageModel,
  submitClinicMetaMessageModel,
  type MetaMessageModelDraft,
  type MetaMessageModelPayload,
} from "../actions";

type MetaButtonKind = "none" | "quick_reply" | "url" | "phone";

function translateMetaError(raw: string): string {
  const msg = String(raw || "").trim();
  if (!msg) return "Erro ao processar resposta da Meta.";
  const lower = msg.toLowerCase();

  // Mensagens textuais comuns da API da Meta
  if (lower.includes("this template has too many variables for its length")) {
    return "Este modelo tem muitas variáveis para o tamanho do texto. Reduza variáveis ou aumente a mensagem.";
  }
  if (lower.includes("variables cannot be at the start or end of the template")) {
    return "As variáveis não podem estar no início nem no fim do modelo.";
  }
  if (lower.includes("template has too many variables")) {
    return "Este modelo tem variáveis em excesso para o conteúdo informado.";
  }
  if (lower.includes("parameter format mismatch")) {
    return "Os parâmetros do template não estão no formato esperado pela Meta.";
  }

  // O retorno da Meta costuma vir como "(#130429) Rate limit hit"
  const codeMatch = msg.match(/#?(\d{3,6})/);
  const code = codeMatch ? Number(codeMatch[1]) : null;
  if (!code) return msg;

  const codeTranslations: Record<number, string> = {
    0: "Falha de autenticação da integração com a Meta. Reconecte a conta.",
    3: "Permissão/capacidade insuficiente para esta ação na API da Meta.",
    10: "Permissão negada pela Meta. Verifique permissões da integração.",
    190: "Token de acesso expirado ou inválido. Reconecte a integração com a Meta.",
    368: "Conta temporariamente bloqueada por política da Meta.",
    80007: "A conta atingiu limite de taxa. Tente novamente em instantes.",
    130429: "Limite de throughput atingido na Cloud API. Aguarde e tente novamente.",
    131048: "Limite por spam atingido. Verifique qualidade do número/template.",
    131056: "Limite para o mesmo remetente/destinatário atingido. Aguarde antes de reenviar.",
    132000: "Quantidade de variáveis enviada não corresponde ao template.",
    132001: "Template não existe nesse idioma ou ainda não foi aprovado.",
    132005: "Texto traduzido do template excede o tamanho permitido.",
    132007: "Conteúdo do template viola política da Meta.",
    132012: "Formato dos parâmetros do template está incorreto.",
    132015: "Template pausado por baixa qualidade.",
    132016: "Template desativado permanentemente por baixa qualidade.",
    2388019: "Limite de modelos de mensagem excedido para esta conta (máximo de 250 templates).",
    2388040: "Um campo do modelo excedeu o limite máximo de caracteres permitido.",
    2388047: "Formato do cabeçalho inválido.",
    2388072: "Formato do corpo da mensagem inválido.",
    2388073: "Formato do rodapé inválido.",
    2388293: "Muitas variáveis para o tamanho da mensagem. Reduza variáveis ou aumente o texto.",
    2388299: "Variáveis não podem estar no início nem no fim do modelo.",
  };

  if (code >= 200 && code <= 299) {
    return `Meta (#${code}): permissão ausente/removida para executar esta ação.`;
  }

  const translated = codeTranslations[code];
  return translated ? `Meta (#${code}): ${translated}` : msg;
}

function toMetaBodyVariableTokens(text: string): string[] {
  const matches = text.match(/\{\{\d+\}\}/g) ?? [];
  return Array.from(new Set(matches));
}

function stripMetaVariables(text: string): string {
  return text.replace(/\{\{\d+\}\}/g, "").trim();
}

function validateMetaBody(text: string) {
  const trimmed = text.trim();
  const vars = toMetaBodyVariableTokens(trimmed);
  const uniqueVarNumbers = Array.from(
    new Set(
      vars.map((token) => Number(token.replace(/[^\d]/g, ""))).filter((n) => Number.isFinite(n))
    )
  ).sort((a, b) => a - b);
  const plainLength = stripMetaVariables(trimmed).length;
  const errors: string[] = [];

  if (!trimmed) {
    errors.push("Corpo é obrigatório.");
    return { errors, vars };
  }
  if (/^\s*\{\{\d+\}\}/.test(trimmed) || /\{\{\d+\}\}\s*$/.test(trimmed)) {
    errors.push("As variáveis não podem estar no início ou no fim do modelo.");
  }
  if (uniqueVarNumbers.length > 0) {
    const expected = Array.from({ length: uniqueVarNumbers.length }, (_, i) => i + 1);
    const sequential = expected.every((num, idx) => num === uniqueVarNumbers[idx]);
    if (!sequential) {
      errors.push("As variáveis devem seguir a sequência {{1}}, {{2}}, {{3}}...");
    }
  }
  if (vars.length > 0 && plainLength / vars.length < 22) {
    errors.push(
      "Este modelo contém muitas variáveis para sua extensão. Reduza o número de variáveis ou aumente a extensão da mensagem."
    );
  }
  if (vars.length > 10) {
    errors.push("A Meta permite no máximo 10 variáveis no corpo.");
  }
  return { errors, vars };
}

function compileMetaComponents(input: {
  headerText: string;
  bodyText: string;
  footerText: string;
  buttonKind: MetaButtonKind;
  buttonText: string;
  buttonValue: string;
  bodyVariableExamples: Record<string, string>;
}) {
  const components: Array<Record<string, unknown>> = [];
  if (input.headerText.trim()) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: input.headerText.trim(),
    });
  }

  const bodyVars = toMetaBodyVariableTokens(input.bodyText);
  const bodyExample = bodyVars.length
    ? [bodyVars.map((token) => input.bodyVariableExamples[token] || "exemplo")]
    : undefined;

  components.push({
    type: "BODY",
    text: input.bodyText.trim(),
    ...(bodyExample ? { example: { body_text: bodyExample } } : {}),
  });

  if (input.footerText.trim()) {
    components.push({
      type: "FOOTER",
      text: input.footerText.trim(),
    });
  }

  if (input.buttonKind !== "none" && input.buttonText.trim()) {
    if (input.buttonKind === "quick_reply") {
      components.push({
        type: "BUTTONS",
        buttons: [
          {
            type: "QUICK_REPLY",
            text: input.buttonText.trim(),
          },
        ],
      });
    } else if (input.buttonKind === "url" && input.buttonValue.trim()) {
      components.push({
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: input.buttonText.trim(),
            url: input.buttonValue.trim(),
          },
        ],
      });
    } else if (input.buttonKind === "phone" && input.buttonValue.trim()) {
      components.push({
        type: "BUTTONS",
        buttons: [
          {
            type: "PHONE_NUMBER",
            text: input.buttonText.trim(),
            phone_number: input.buttonValue.trim(),
          },
        ],
      });
    }
  }

  return components;
}

function WhatsAppTemplatePreview({
  headerText,
  bodyText,
  footerText,
}: {
  headerText: string;
  bodyText: string;
  footerText: string;
}) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const previewBody = bodyText || "Digite o corpo do modelo...";

  return (
    <div className="rounded-xl border border-border bg-[#d1ccc6] dark:bg-[#0b141a] p-4 shadow-inner">
      <div className="rounded-lg px-3 py-2 shadow-md max-w-[320px] bg-white dark:bg-[#202c33]">
        {headerText.trim() ? (
          <p className="text-xs font-semibold text-[#111b21] dark:text-[#e9edef] mb-2">{headerText}</p>
        ) : null}
        <p className="text-sm text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap break-words">{previewBody}</p>
        {footerText.trim() ? (
          <p className="text-[11px] text-[#667781] dark:text-[#8696a0] mt-2">{footerText}</p>
        ) : null}
        <p className="text-[10px] text-[#667781] dark:text-[#8696a0] text-right mt-1">{timeStr}</p>
      </div>
    </div>
  );
}

export function MetaModelsClient({
  initialModels,
}: {
  initialModels: MetaMessageModelDraft[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [metaCategory, setMetaCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [metaLanguage, setMetaLanguage] = useState("pt_BR");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttonKind, setButtonKind] = useState<MetaButtonKind>("none");
  const [buttonText, setButtonText] = useState("");
  const [buttonValue, setButtonValue] = useState("");
  const [bodyVariableExamples, setBodyVariableExamples] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});

  const bodyValidation = validateMetaBody(bodyText);

  async function handleCreate() {
    setError(null);
    if (bodyValidation.errors.length > 0) {
      setError(bodyValidation.errors[0]);
      return;
    }
    setSaving(true);
    const components = compileMetaComponents({
      headerText,
      bodyText,
      footerText,
      buttonKind,
      buttonText,
      buttonValue,
      bodyVariableExamples,
    });
    const payload: MetaMessageModelPayload = {
      name,
      eventCode: null,
      metaCategory,
      bodyText,
      metaLanguage,
      metaComponents: components,
    };
    const res = await createClinicMetaMessageModel(payload);
    setSaving(false);
    if (res.error) {
      setError(translateMetaError(res.error));
      return;
    }
    setOpen(false);
    setName("");
    setMetaCategory("UTILITY");
    setMetaLanguage("pt_BR");
    setHeaderText("");
    setBodyText("");
    setFooterText("");
    setButtonKind("none");
    setButtonText("");
    setButtonValue("");
    setBodyVariableExamples({});
    router.refresh();
  }

  async function handleSubmit(id: string) {
    setSubmitErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSubmittingId(id);
    const res = await submitClinicMetaMessageModel(id);
    setSubmittingId(null);
    if (res.error) {
      setSubmitErrors((prev) => ({ ...prev, [id]: translateMetaError(res.error || "Erro ao enviar para Meta.") }));
      router.refresh();
      return;
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja excluir este modelo Meta?")) return;
    setDeletingId(id);
    const res = await deleteClinicMetaMessageModel(id);
    setDeletingId(null);
    if (res.error) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  const bodyVars = toMetaBodyVariableTokens(bodyText);

  function insertBodyVariable() {
    const textarea = document.getElementById("meta-body-text") as HTMLTextAreaElement | null;
    const existingNumbers = bodyVars.map((token) => Number(token.replace(/[^\d]/g, ""))).filter((n) => Number.isFinite(n));
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const token = `{{${nextNum}}}`;
    if (!textarea) {
      setBodyText((prev) => `${prev}${prev ? " " : ""}${token}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextText = bodyText.substring(0, start) + token + bodyText.substring(end);
    setBodyText(nextText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Modelos locais para preparar e enviar para aprovação na Meta.
        </p>
        <Button onClick={() => setOpen(true)}>Novo modelo Meta</Button>
      </div>

      {initialModels.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">Nenhum modelo Meta criado ainda.</Card>
      ) : (
        <div className="space-y-2">
          {initialModels.map((model) => (
            <Card key={model.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{model.name}</p>
                  <p className="text-xs text-muted-foreground">Categoria: {model.meta_category}</p>
                  <p className="text-xs text-muted-foreground">Idioma: {model.meta_language || "pt_BR"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={model.status === "submitted" ? "default" : "outline"}>
                    {model.status}
                  </Badge>
                  {model.meta_status && <Badge variant="secondary">Meta: {model.meta_status}</Badge>}
                </div>
              </div>
              <p className="text-sm mt-3 whitespace-pre-wrap">{model.body_text}</p>
              {model.last_error && (
                <p className="text-xs mt-2 text-destructive break-words whitespace-pre-wrap">
                  {translateMetaError(model.last_error)}
                </p>
              )}
              {submitErrors[model.id] && (
                <p className="text-xs mt-2 text-destructive break-words whitespace-pre-wrap">
                  {submitErrors[model.id]}
                </p>
              )}
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={() => handleSubmit(model.id)}
                  disabled={model.status === "submitted" || submittingId === model.id}
                >
                  {submittingId === model.id ? "Enviando..." : "Enviar para Meta"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(model.id)}
                  disabled={deletingId === model.id}
                >
                  {deletingId === model.id ? "Excluindo..." : "Excluir"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Novo modelo de mensagem Meta"
          onClose={() => setOpen(false)}
          className="w-[96vw] sm:w-[96vw] sm:max-w-6xl max-h-[95vh] overflow-y-auto"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_320px] min-w-0">
            <div className="space-y-3 min-w-0">
              <div className="min-h-5">
                {error ? <p className="text-sm text-destructive break-words whitespace-pre-wrap">{error}</p> : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Nome do modelo</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: lembrete_consulta_flowmedi" />
                </div>
                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <select
                    value={metaLanguage}
                    onChange={(e) => setMetaLanguage(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="pt_BR">Português (Brasil)</option>
                    <option value="en_US">English (US)</option>
                    <option value="es_ES">Español</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <select
                    value={metaCategory}
                    onChange={(e) => setMetaCategory(e.target.value as "MARKETING" | "UTILITY" | "AUTHENTICATION")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="UTILITY">Utilidade</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="AUTHENTICATION">Autenticação</option>
                  </select>
                </div>
              </div>

              <Card className="p-3 space-y-3">
                <p className="text-sm font-medium">Conteúdo</p>
                <div className="space-y-2">
                  <Label>Cabeçalho (opcional)</Label>
                  <Input value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60} />
                </div>
                <div className="space-y-2">
                  <Label>Corpo</Label>
                  <Textarea
                    id="meta-body-text"
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    rows={8}
                    placeholder="Ex.: Olá {{1}}, sua consulta está confirmada para {{2}}."
                  />
                  <p className="text-xs text-muted-foreground">
                    Use variáveis posicionais no padrão Meta: {"{{1}}"}, {"{{2}}"}, {"{{3}}"}...
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="outline" onClick={insertBodyVariable}>
                    + Adicionar variável
                  </Button>
                </div>

                <div className="space-y-1 min-h-[56px]">
                  {bodyValidation.errors.map((msg, idx) => (
                    <p key={`${msg}-${idx}`} className="text-xs text-destructive">
                      {msg}
                    </p>
                  ))}
                </div>

                {bodyVars.length > 0 && (
                  <div className="space-y-2">
                    <Label>Amostras das variáveis do corpo</Label>
                    <div className="space-y-2">
                      {bodyVars.map((token) => (
                        <div key={token} className="grid grid-cols-[80px_1fr] gap-2">
                          <Input value={token} disabled />
                          <Input
                            value={bodyVariableExamples[token] || ""}
                            onChange={(e) =>
                              setBodyVariableExamples((prev) => ({ ...prev, [token]: e.target.value }))
                            }
                            placeholder={`Conteúdo para ${token}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Rodapé (opcional)</Label>
                  <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} maxLength={60} />
                </div>
              </Card>

              <Card className="p-3 space-y-3">
                <p className="text-sm font-medium">Botões (opcional)</p>
                <div className="space-y-2">
                  <Label>Tipo de botão</Label>
                  <select
                    value={buttonKind}
                    onChange={(e) => setButtonKind(e.target.value as MetaButtonKind)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="none">Nenhum</option>
                    <option value="quick_reply">Resposta rápida</option>
                    <option value="url">URL</option>
                    <option value="phone">Telefone</option>
                  </select>
                </div>
                {buttonKind !== "none" && (
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Texto do botão</Label>
                      <Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{buttonKind === "url" ? "URL" : buttonKind === "phone" ? "Telefone" : "Valor"}</Label>
                      <Input value={buttonValue} onChange={(e) => setButtonValue(e.target.value)} />
                    </div>
                  </div>
                )}
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleCreate} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar modelo"}
                </Button>
              </div>
            </div>
            <Card className="p-3 h-fit min-w-0">
              <p className="text-sm font-medium mb-2">Prévia do modelo</p>
              <WhatsAppTemplatePreview
                headerText={headerText}
                bodyText={bodyText}
                footerText={footerText}
              />
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
