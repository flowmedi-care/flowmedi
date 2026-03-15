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
  type MessageEvent,
  type MetaMessageModelDraft,
  type MetaMessageModelPayload,
  type SystemMetaTemplateKey,
} from "../actions";

type MetaButtonKind = "none" | "quick_reply" | "url" | "phone";

function toMetaBodyVariableTokens(text: string): string[] {
  const matches = text.match(/\{\{\d+\}\}/g) ?? [];
  return Array.from(new Set(matches));
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
  events,
}: {
  initialModels: MetaMessageModelDraft[];
  events: MessageEvent[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [eventCode, setEventCode] = useState("");
  const [templateKey, setTemplateKey] = useState<SystemMetaTemplateKey>("flowmedi_consulta");
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

  async function handleCreate() {
    setError(null);
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
      eventCode,
      templateKey,
      bodyText,
      metaLanguage,
      metaComponents: components,
    };
    const res = await createClinicMetaMessageModel(payload);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setName("");
    setEventCode("");
    setTemplateKey("flowmedi_consulta");
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
    setSubmittingId(id);
    const res = await submitClinicMetaMessageModel(id);
    setSubmittingId(null);
    if (res.error) {
      alert(res.error);
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
                  <p className="text-xs text-muted-foreground">
                    Evento: {events.find((e) => e.code === model.event_code)?.name || model.event_code}
                  </p>
                  <p className="text-xs text-muted-foreground">Modelo: {model.template_key}</p>
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
                <p className="text-xs mt-2 text-destructive">{model.last_error}</p>
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
        <DialogContent title="Novo modelo de mensagem Meta" onClose={() => setOpen(false)} className="max-w-[96vw] sm:max-w-6xl">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
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
                  <Label>Evento vinculado</Label>
                  <select
                    value={eventCode}
                    onChange={(e) => setEventCode(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecione</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.code}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Card className="p-3 space-y-3">
                <p className="text-sm font-medium">Conteúdo</p>
                <div className="space-y-2">
                  <Label>Tipo de modelo</Label>
                  <select
                    value={templateKey}
                    onChange={(e) => setTemplateKey(e.target.value as SystemMetaTemplateKey)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="flowmedi_consulta">Consulta</option>
                    <option value="flowmedi_agenda_com_formulario">Consulta com formulário</option>
                    <option value="flowmedi_formulario">Formulário</option>
                    <option value="flowmedi_aviso">Aviso</option>
                    <option value="flowmedi_mensagem_livre">Mensagem livre</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Cabeçalho (opcional)</Label>
                  <Input value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60} />
                </div>
                <div className="space-y-2">
                  <Label>Corpo</Label>
                  <Textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    rows={8}
                    placeholder="Ex.: Olá {{1}}, sua consulta está confirmada para {{2}}."
                  />
                  <p className="text-xs text-muted-foreground">
                    Use variáveis posicionais no padrão Meta: {"{{1}}"}, {"{{2}}"}, {"{{3}}"}...
                  </p>
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
            <Card className="p-3 h-fit">
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
