"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Code2, Mail, MessageSquare, Palette, Plus } from "lucide-react";
import { VisualEditor, blocksToHtml } from "@/components/email-template-builder/visual-editor";
import { type EmailBlock } from "@/components/email-template-builder/types";
import {
  createMessageTemplate,
  getClinicEmailBranding,
  type MessageEvent,
  type SystemMetaTemplateKey,
} from "../actions";

type ChannelChoice = "email" | "whatsapp" | "both";
type WizardStep = "base" | "email" | "whatsapp" | "review";

const EMAIL_AVAILABLE_VARIABLES = [
  "{{nome_paciente}}",
  "{{data_consulta}}",
  "{{hora_consulta}}",
  "{{nome_medico}}",
  "{{link_formulario}}",
  "{{nome_clinica}}",
  "{{telefone_clinica}}",
];

function toHtmlFromText(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function composeWhatsappText(templateKey: SystemMetaTemplateKey, message: string) {
  const core = message.trim() || "{{mensagem}}";
  if (templateKey === "flowmedi_formulario") {
    return `Olá {{nome_paciente}}!\n\nPrecisamos da sua ajuda com um formulário da clínica.\n\n${core}\n\nObrigado pelo apoio.\n\n{{nome_clinica}}`;
  }
  if (templateKey === "flowmedi_aviso") {
    return `Olá {{nome_paciente}}!\n\nTemos um aviso importante.\n\n${core}\n\nEstamos à disposição para dúvidas.\n\n{{nome_clinica}}`;
  }
  if (templateKey === "flowmedi_mensagem_livre") {
    return `Oi, {{nome_paciente}}.\n\n${core}\n\nQualquer dúvida, estamos à disposição.\n\n{{nome_clinica}}`;
  }
  return `Olá {{nome_paciente}}!\n\nTemos uma mensagem importante sobre sua consulta.\n\n${core}\n\nSe precisar, responda esta mensagem.\n\n{{nome_clinica}}`;
}

function WhatsAppPreviewBubble({ text }: { text: string }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="rounded-xl border border-border bg-[#d1ccc6] dark:bg-[#0b141a] p-4 shadow-inner">
      <div className="rounded-lg px-3 py-2 shadow-md max-w-[320px] bg-[#c6e7b8] dark:bg-[#005c4b]">
        <p className="text-sm text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap break-words">{text}</p>
        <p className="text-[10px] text-[#667781] dark:text-[#8696a0] text-right mt-1">{timeStr}</p>
      </div>
    </div>
  );
}

export function NewTemplateWizardModal({
  events,
  canUseEmailTemplates,
  canUseWhatsAppTemplates,
  triggerLabel = "Novo Template",
  triggerVariant = "default",
}: {
  events: MessageEvent[];
  canUseEmailTemplates: boolean;
  canUseWhatsAppTemplates: boolean;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
  const [step, setStep] = useState<WizardStep>("base");
  const [emailHeader, setEmailHeader] = useState<string>("");
  const [emailFooter, setEmailFooter] = useState<string>("");

  const includeEmail = channel === "email" || channel === "both";
  const includeWhatsapp = channel === "whatsapp" || channel === "both";

  const steps = useMemo<WizardStep[]>(() => {
    return ["base", ...(includeEmail ? ["email" as const] : []), ...(includeWhatsapp ? ["whatsapp" as const] : []), "review"];
  }, [includeEmail, includeWhatsapp]);
  const stepIndex = steps.indexOf(step);
  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < steps.length - 1;

  useEffect(() => {
    if (!open) return;
    getClinicEmailBranding().then((res) => {
      setEmailHeader(res.data?.email_header ?? "");
      setEmailFooter(res.data?.email_footer ?? "");
    });
  }, [open]);

  function resetForm() {
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
    setStep("base");
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
    }
    if (step === "whatsapp") {
      if (!whatsappMessage.trim()) return "Informe a mensagem principal do WhatsApp.";
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

  async function handleFinish() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);

    const tasks: Array<Promise<{ error: string | null }>> = [];

    if (includeEmail) {
      tasks.push(
        createMessageTemplate(
          eventCode,
          channel === "both" ? `${name} - Email` : name,
          "email",
          emailSubject.trim(),
          emailBody,
          emailBody,
          [],
          null,
          null
        ).then((res) => ({ error: res.error }))
      );
    }

    if (includeWhatsapp) {
      const whatsappText = composeWhatsappText(whatsappTemplateKey, whatsappMessage);
      tasks.push(
        createMessageTemplate(
          eventCode,
          channel === "both" ? `${name} - WhatsApp` : name,
          "whatsapp",
          null,
          toHtmlFromText(whatsappText),
          whatsappText,
          [],
          null,
          null,
          whatsappMessage
        ).then((res) => ({ error: res.error }))
      );
    }

    const results = await Promise.all(tasks);
    const firstError = results.find((r) => r.error)?.error ?? null;
    setLoading(false);
    if (firstError) {
      setError(firstError);
      return;
    }
    setOpen(false);
    resetForm();
    router.refresh();
  }

  const whatsappPreview = composeWhatsappText(whatsappTemplateKey, whatsappMessage);
  const emailPreviewHtml = `${emailHeader || ""}${emailBody || ""}${emailFooter || ""}`;
  const emailBodyText = emailBody.replace(/<[^>]*>/g, "").trim();

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
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        {triggerLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) resetForm();
        }}
      >
        <DialogContent
          title="Novo template (passo a passo)"
          onClose={() => {
            setOpen(false);
            resetForm();
          }}
          className="max-w-[96vw] sm:max-w-5xl"
        >
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
                <div className="space-y-2 md:col-span-2">
                  <Label>Modelo será enviado por</Label>
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
                      initialBlocks={emailBlocks}
                      channel="email"
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
                        {EMAIL_AVAILABLE_VARIABLES.map((variable) => (
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
                    </div>
                  )}
                </div>
                <Card className="p-3 overflow-auto max-h-[60vh]">
                  <p className="text-xs text-muted-foreground mb-2">Preview do email (com cabeçalho/rodapé)</p>
                  <p className="text-sm rounded bg-muted/50 p-2 mb-3">
                    <strong>Assunto:</strong> {emailSubject || "(sem assunto)"}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Texto plano: {emailBodyText || "(vazio)"}
                  </p>
                  <div
                    className="rounded bg-white p-2 text-sm"
                    dangerouslySetInnerHTML={{ __html: emailPreviewHtml || "<p>(sem conteúdo)</p>" }}
                  />
                </Card>
              </div>
            )}

            {step === "whatsapp" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Modelo pré-definido</Label>
                    <select
                      value={whatsappTemplateKey}
                      onChange={(e) => setWhatsappTemplateKey(e.target.value as SystemMetaTemplateKey)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="flowmedi_consulta">Consulta</option>
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
                </div>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground mb-2">Preview do WhatsApp</p>
                  <WhatsAppPreviewBubble text={whatsappPreview} />
                </Card>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-3 text-sm">
                <p><strong>Nome:</strong> {name}</p>
                <p><strong>Evento:</strong> {events.find((e) => e.code === eventCode)?.name || eventCode}</p>
                <p><strong>Canais:</strong> {channel === "both" ? "Email + WhatsApp" : channel === "email" ? "Email" : "WhatsApp"}</p>
                {includeEmail && (
                  <p><strong>Email:</strong> assunto preenchido e corpo pronto para salvar.</p>
                )}
                {includeWhatsapp && (
                  <p><strong>WhatsApp:</strong> modelo {whatsappTemplateKey} com mensagem personalizada.</p>
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
                  {loading ? "Salvando..." : "Concluir"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
