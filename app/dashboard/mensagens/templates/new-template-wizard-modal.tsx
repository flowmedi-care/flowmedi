"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Code2, Mail, MessageSquare, Palette, Plus } from "lucide-react";
import { VisualEditor, blocksToHtml } from "@/components/email-template-builder/visual-editor";
import { htmlToBlocks } from "@/components/email-template-builder/html-converter";
import { type EmailBlock } from "@/components/email-template-builder/types";
import {
  extractTemplateVariables,
  getAllowedVariablesForEventChannel,
  getOptionalBlankRiskVariablesForEventChannel,
} from "@/lib/message-variable-catalog";
import {
  createMessageTemplate,
  getClinicEmailBranding,
  updateMessageTemplate,
  type MessageChannel,
  type MessageEvent,
  type MessageTemplate,
  type SystemMetaTemplateKey,
} from "../actions";
import { EmailPreviewPanel, WhatsAppPreviewBubble } from "./template-preview";

type ChannelChoice = "email" | "whatsapp" | "both";
type WizardStep = "base" | "email" | "whatsapp" | "review";
export type WizardMode = "create" | "edit" | "fromSystem";

export type SystemSourceData = {
  eventCode: string;
  channel: MessageChannel;
  name: string;
  subject: string | null;
  body_html: string;
  body_text: string | null;
  whatsapp_meta_phrase?: string | null;
};

function toHtmlFromText(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function composeWhatsappText(templateKey: SystemMetaTemplateKey, message: string) {
  const core = message.trim() || "uma mensagem importante da clínica";
  if (templateKey === "flowmedi_formulario") {
    return `Olá {{primeiro_nome_paciente}}!\n\nPrecisamos da sua ajuda com um formulário da clínica.\n\n${core}\n\nObrigado pelo apoio.\n\n{{nome_clinica}}`;
  }
  if (templateKey === "flowmedi_agenda_com_formulario") {
    return `Olá {{primeiro_nome_paciente}}!\n\nTemos uma mensagem importante sobre sua consulta.\n\n${core}\n\nPara preencher antes da consulta, acesse: {{link_formulario}}\n\nSe precisar, responda esta mensagem.\n\n{{nome_clinica}}`;
  }
  if (templateKey === "flowmedi_aviso") {
    return `Olá {{primeiro_nome_paciente}}!\n\nTemos um aviso importante.\n\n${core}\n\nEstamos à disposição para dúvidas.\n\n{{nome_clinica}}`;
  }
  if (templateKey === "flowmedi_mensagem_livre") {
    return `Oi, {{primeiro_nome_paciente}}.\n\n${core}\n\nQualquer dúvida, estamos à disposição.\n\n{{nome_clinica}}`;
  }
  return `Olá {{primeiro_nome_paciente}}!\n\nTemos uma mensagem importante sobre sua consulta.\n\n${core}\n\nSe precisar, responda esta mensagem.\n\n{{nome_clinica}}`;
}

export function TemplateWizardModal({
  events,
  canUseEmailTemplates,
  canUseWhatsAppTemplates,
  mode = "create",
  templateId,
  initialTemplate,
  systemSource,
  open: controlledOpen,
  onOpenChange,
  triggerLabel = "Novo Template",
  triggerVariant = "default",
  hideTrigger = false,
}: {
  events: MessageEvent[];
  canUseEmailTemplates: boolean;
  canUseWhatsAppTemplates: boolean;
  mode?: WizardMode;
  templateId?: string;
  initialTemplate?: MessageTemplate;
  systemSource?: SystemSourceData;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventCode, setEventCode] = useState("");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<ChannelChoice>("email");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailBlocks, setEmailBlocks] = useState<EmailBlock[]>([]);
  const [emailEditorMode, setEmailEditorMode] = useState<"visual" | "html">("visual");
  const [whatsappTemplateKey, setWhatsappTemplateKey] = useState<SystemMetaTemplateKey>("flowmedi_consulta");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappFullBody, setWhatsappFullBody] = useState("");
  const [whatsappUsePhraseMode, setWhatsappUsePhraseMode] = useState(false);
  const [step, setStep] = useState<WizardStep>("base");
  const [emailHeader, setEmailHeader] = useState<string>("");
  const [emailFooter, setEmailFooter] = useState<string>("");

  const isCreate = mode === "create";
  const isEdit = mode === "edit";
  const isFromSystem = mode === "fromSystem";
  const lockEventChannel = isEdit || isFromSystem;

  const includeEmail = channel === "email" || channel === "both";
  const includeWhatsapp = channel === "whatsapp" || channel === "both";
  const emailAllowedVariables = useMemo(
    () => getAllowedVariablesForEventChannel(eventCode, "email"),
    [eventCode]
  );
  const emailUsedVariables = useMemo(
    () => extractTemplateVariables(`${emailSubject}\n${emailBody}`),
    [emailSubject, emailBody]
  );
  const emailUnavailableVariables = useMemo(() => {
    const allowedSet = new Set(emailAllowedVariables);
    return emailUsedVariables.filter((variable) => !allowedSet.has(variable));
  }, [emailAllowedVariables, emailUsedVariables]);
  const emailOptionalBlankRiskVariables = useMemo(
    () => getOptionalBlankRiskVariablesForEventChannel(emailUsedVariables, eventCode, "email"),
    [emailUsedVariables, eventCode]
  );

  const steps = useMemo<WizardStep[]>(() => {
    return ["base", ...(includeEmail ? ["email" as const] : []), ...(includeWhatsapp ? ["whatsapp" as const] : []), "review"];
  }, [includeEmail, includeWhatsapp]);
  const stepIndex = steps.indexOf(step);
  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < steps.length - 1;

  const resetForm = useCallback(() => {
    setError(null);
    setEventCode("");
    setName("");
    setChannel("email");
    setEmailSubject("");
    setEmailBody("");
    setEmailBlocks([]);
    setEmailEditorMode("visual");
    setWhatsappTemplateKey("flowmedi_consulta");
    setWhatsappMessage("");
    setWhatsappFullBody("");
    setWhatsappUsePhraseMode(false);
    setStep("base");
  }, []);

  const prefillFromTemplate = useCallback((template: MessageTemplate) => {
    setEventCode(template.event_code);
    setName(template.name);
    setChannel(template.channel);
    setEmailSubject(template.subject || "");
    setEmailBody(template.body_html || "");
    setEmailBlocks(htmlToBlocks(template.body_html || ""));
    setEmailEditorMode("visual");

    const phrase = template.whatsapp_meta_phrase?.trim();
    if (template.channel === "whatsapp") {
      if (phrase) {
        setWhatsappUsePhraseMode(true);
        setWhatsappMessage(phrase);
        setWhatsappFullBody(template.body_text || "");
      } else {
        setWhatsappUsePhraseMode(false);
        setWhatsappFullBody(template.body_text || template.body_html?.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "") || "");
      }
    }
    setStep("base");
  }, []);

  const prefillFromSystem = useCallback((source: SystemSourceData) => {
    setEventCode(source.eventCode);
    setName(`${source.name} (cópia)`);
    setChannel(source.channel);
    setEmailSubject(source.subject || "");
    setEmailBody(source.body_html || "");
    setEmailBlocks(htmlToBlocks(source.body_html || ""));
    setEmailEditorMode("visual");

    const phrase = source.whatsapp_meta_phrase?.trim();
    if (source.channel === "whatsapp") {
      if (phrase) {
        setWhatsappUsePhraseMode(true);
        setWhatsappMessage(phrase);
        setWhatsappFullBody(source.body_text || "");
      } else {
        setWhatsappUsePhraseMode(false);
        setWhatsappFullBody(
          source.body_text || source.body_html?.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "") || ""
        );
      }
    }
    setStep("base");
  }, []);

  useEffect(() => {
    if (!open) return;
    getClinicEmailBranding().then((res) => {
      setEmailHeader(res.data?.email_header ?? "");
      setEmailFooter(res.data?.email_footer ?? "");
    });

    if (isEdit && initialTemplate) {
      prefillFromTemplate(initialTemplate);
    } else if (isFromSystem && systemSource) {
      prefillFromSystem(systemSource);
    } else if (isCreate) {
      resetForm();
    }
  }, [open, isEdit, isFromSystem, isCreate, initialTemplate, systemSource, prefillFromTemplate, prefillFromSystem, resetForm]);

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  function validateCurrentStep(): string | null {
    if (step === "base") {
      if (!name.trim()) return "Informe o nome do template.";
      if (!eventCode) return "Selecione um evento.";
      if (channel === "email" && !canUseEmailTemplates) return "Seu plano não permite criar template de email.";
      if (channel === "whatsapp" && !canUseWhatsAppTemplates) return "Seu plano não permite criar template de WhatsApp.";
      if (channel === "both" && (!canUseEmailTemplates || !canUseWhatsAppTemplates)) {
        return "Para criar template em ambos os canais, seu plano precisa permitir email e WhatsApp.";
      }
    }
    if (step === "email") {
      if (!emailSubject.trim()) return "Informe o assunto do email.";
      if (!emailBody.trim()) return "Informe o corpo do email.";
      if (emailUnavailableVariables.length > 0) {
        return `Variáveis fora do escopo deste evento/canal: ${emailUnavailableVariables.join(", ")}.`;
      }
    }
    if (step === "whatsapp") {
      if (isCreate && !whatsappUsePhraseMode && !whatsappMessage.trim()) {
        return "Informe a mensagem principal do WhatsApp.";
      }
      if (!isCreate && whatsappUsePhraseMode && !whatsappMessage.trim()) {
        return "Informe a mensagem principal do WhatsApp.";
      }
      if (!isCreate && !whatsappUsePhraseMode && !whatsappFullBody.trim()) {
        return "Informe o corpo da mensagem do WhatsApp.";
      }
    }
    return null;
  }

  async function handleNext() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (!canGoNext) return;
    setStep(steps[stepIndex + 1]);
  }

  function handleBack() {
    if (!canGoBack) return;
    setError(null);
    setStep(steps[stepIndex - 1]);
  }

  function getWhatsappSavePayload(): { bodyHtml: string; bodyText: string; phrase: string | null } {
    if (!isCreate && whatsappUsePhraseMode) {
      const bodyText = composeWhatsappText(whatsappTemplateKey, whatsappMessage);
      return {
        bodyHtml: toHtmlFromText(bodyText),
        bodyText,
        phrase: whatsappMessage.trim() || null,
      };
    }
    if (!isCreate && !whatsappUsePhraseMode) {
      const bodyText = whatsappFullBody.trim();
      return { bodyHtml: toHtmlFromText(bodyText), bodyText, phrase: null };
    }
    const bodyText = composeWhatsappText(whatsappTemplateKey, whatsappMessage);
    return {
      bodyHtml: toHtmlFromText(bodyText),
      bodyText,
      phrase: whatsappMessage.trim() || null,
    };
  }

  async function handleFinish() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (isEdit && templateId) {
        if (includeEmail) {
          const res = await updateMessageTemplate(
            templateId,
            name.trim(),
            emailSubject.trim(),
            emailBody,
            emailBody.replace(/<[^>]*>/g, "").trim(),
            [],
            null,
            null
          );
          if (res.error) {
            setError(res.error);
            return;
          }
        } else if (includeWhatsapp) {
          const { bodyHtml, bodyText, phrase } = getWhatsappSavePayload();
          const res = await updateMessageTemplate(
            templateId,
            name.trim(),
            null,
            bodyHtml,
            bodyText,
            [],
            null,
            null,
            phrase
          );
          if (res.error) {
            setError(res.error);
            return;
          }
        }
      } else {
        const tasks: Array<Promise<{ error: string | null }>> = [];

        if (includeEmail) {
          tasks.push(
            createMessageTemplate(
              eventCode,
              channel === "both" ? `${name} - Email` : name,
              "email",
              emailSubject.trim(),
              emailBody,
              emailBody.replace(/<[^>]*>/g, "").trim(),
              [],
              null,
              null
            ).then((res) => ({ error: res.error }))
          );
        }

        if (includeWhatsapp) {
          const { bodyHtml, bodyText, phrase } = getWhatsappSavePayload();
          tasks.push(
            createMessageTemplate(
              eventCode,
              channel === "both" ? `${name} - WhatsApp` : name,
              "whatsapp",
              null,
              bodyHtml,
              bodyText,
              [],
              null,
              null,
              phrase
            ).then((res) => ({ error: res.error }))
          );
        }

        const results = await Promise.all(tasks);
        const firstError = results.find((r) => r.error)?.error ?? null;
        if (firstError) {
          setError(firstError);
          return;
        }
      }

      handleClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const whatsappPreview =
    isCreate || whatsappUsePhraseMode
      ? composeWhatsappText(whatsappTemplateKey, whatsappMessage)
      : whatsappFullBody;

  const dialogTitle =
    isEdit ? "Editar template" : isFromSystem ? "Personalizar template do sistema" : "Novo template (passo a passo)";

  const finishLabel = isEdit ? "Salvar alterações" : isFromSystem ? "Salvar cópia" : "Concluir";

  function insertVariableOnHtml(variable: string) {
    const id = "wizard-email-html";
    const textarea = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = emailBody.substring(0, start) + variable + emailBody.substring(end);
    setEmailBody(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  }

  return (
    <>
      {!hideTrigger && (
        <Button variant={triggerVariant} onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {triggerLabel}
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) resetForm();
        }}
      >
        <DialogContent title={dialogTitle} onClose={handleClose} className="max-w-[96vw] sm:max-w-5xl">
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Passo {stepIndex + 1} de {steps.length}
            </p>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {step === "base" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome do template</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Remarcação padrão" />
                </div>
                <div className="space-y-2">
                  <Label>Evento vinculado</Label>
                  {lockEventChannel ? (
                    <p className="h-10 flex items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                      {events.find((e) => e.code === eventCode)?.name || eventCode}
                    </p>
                  ) : (
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
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Modelo será enviado por</Label>
                  {lockEventChannel ? (
                    <p className="flex items-center gap-2 text-sm h-10">
                      {channel === "email" ? (
                        <>
                          <Mail className="h-4 w-4" />
                          Email
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-4 w-4" />
                          WhatsApp
                        </>
                      )}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" checked={channel === "email"} onChange={() => setChannel("email")} />
                        <Mail className="h-4 w-4" />
                        Email
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" checked={channel === "whatsapp"} onChange={() => setChannel("whatsapp")} />
                        <MessageSquare className="h-4 w-4" />
                        WhatsApp
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" checked={channel === "both"} onChange={() => setChannel("both")} />
                        Email + WhatsApp
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === "email" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Assunto</Label>
                    <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Assunto do email" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={emailEditorMode === "visual" ? "default" : "outline"}
                      onClick={() => setEmailEditorMode("visual")}
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Visual
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={emailEditorMode === "html" ? "default" : "outline"}
                      onClick={() => setEmailEditorMode("html")}
                    >
                      <Code2 className="h-4 w-4 mr-2" />
                      HTML
                    </Button>
                  </div>

                  {emailEditorMode === "visual" ? (
                    <VisualEditor
                      key={`${templateId ?? systemSource?.eventCode ?? "new"}-email`}
                      initialBlocks={emailBlocks}
                      channel="email"
                      availableVariables={emailAllowedVariables}
                      onBlocksChange={(blocks) => {
                        setEmailBlocks(blocks);
                        setEmailBody(blocksToHtml(blocks));
                      }}
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Corpo da mensagem (HTML)</Label>
                        <Textarea
                          id="wizard-email-html"
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          rows={14}
                          className="font-mono text-sm"
                          placeholder="Digite aqui o HTML do email..."
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {emailAllowedVariables.map((variable) => (
                          <Button
                            key={variable}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => insertVariableOnHtml(variable)}
                          >
                            {variable}
                          </Button>
                        ))}
                      </div>
                      {emailUnavailableVariables.length > 0 && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          Variáveis fora do escopo deste evento/canal: {emailUnavailableVariables.join(", ")}
                        </div>
                      )}
                      {emailOptionalBlankRiskVariables.length > 0 && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Estas variáveis podem ficar em branco se não estiverem preenchidas:{" "}
                          {emailOptionalBlankRiskVariables.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <EmailPreviewPanel
                  subject={emailSubject}
                  bodyHtml={emailBody}
                  emailHeader={emailHeader}
                  emailFooter={emailFooter}
                />
              </div>
            )}

            {step === "whatsapp" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {isCreate ? (
                    <>
                      <div className="space-y-2">
                        <Label>Modelo pré-definido</Label>
                        <select
                          value={whatsappTemplateKey}
                          onChange={(e) => setWhatsappTemplateKey(e.target.value as SystemMetaTemplateKey)}
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
                        <Label>Campo editável da mensagem</Label>
                        <Textarea
                          value={whatsappMessage}
                          onChange={(e) => setWhatsappMessage(e.target.value)}
                          rows={10}
                          placeholder="Digite a parte principal da mensagem..."
                        />
                      </div>
                    </>
                  ) : whatsappUsePhraseMode ? (
                    <div className="space-y-2">
                      <Label>Campo editável da mensagem</Label>
                      <Textarea
                        value={whatsappMessage}
                        onChange={(e) => setWhatsappMessage(e.target.value)}
                        rows={10}
                        placeholder="Digite a parte principal da mensagem..."
                      />
                      <p className="text-xs text-muted-foreground">
                        O preview ao lado mostra a mensagem completa como será enviada.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Corpo da mensagem (WhatsApp)</Label>
                      <Textarea
                        value={whatsappFullBody}
                        onChange={(e) => setWhatsappFullBody(e.target.value)}
                        rows={12}
                        placeholder="Digite a mensagem completa..."
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Preview do WhatsApp</p>
                  <WhatsAppPreviewBubble text={whatsappPreview || "(sem conteúdo)"} />
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-3 text-sm">
                <p>
                  <strong>Nome:</strong> {name}
                </p>
                <p>
                  <strong>Evento:</strong> {events.find((e) => e.code === eventCode)?.name || eventCode}
                </p>
                <p>
                  <strong>Canais:</strong>{" "}
                  {channel === "both" ? "Email + WhatsApp" : channel === "email" ? "Email" : "WhatsApp"}
                </p>
                {includeEmail && <p><strong>Email:</strong> assunto preenchido e corpo pronto para salvar.</p>}
                {includeWhatsapp && (
                  <p>
                    <strong>WhatsApp:</strong>{" "}
                    {isCreate ? `modelo ${whatsappTemplateKey} com mensagem personalizada.` : "mensagem pronta para salvar."}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" disabled={!canGoBack || loading} onClick={handleBack}>
                Voltar
              </Button>
              {canGoNext ? (
                <Button onClick={handleNext} disabled={loading}>
                  Próximo
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={loading}>
                  {loading ? "Salvando..." : finishLabel}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NewTemplateWizardModal(
  props: Omit<
    React.ComponentProps<typeof TemplateWizardModal>,
    "mode" | "templateId" | "initialTemplate" | "systemSource" | "open" | "onOpenChange" | "hideTrigger"
  >
) {
  return <TemplateWizardModal {...props} mode="create" />;
}
