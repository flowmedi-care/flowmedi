"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Edit, Trash2, Copy, RefreshCcw, Eye } from "lucide-react";
import {
  deactivateMessageTemplate,
  refreshSystemMetaTemplatesStatus,
  requestSystemMetaTemplates,
  type ClinicMetaTemplateStatus,
  type EffectiveTemplateItem,
  type MessageEvent,
  type MessageTemplate,
  type RemoteMetaTemplateItem,
  type SystemMetaTemplateKey,
} from "../actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TemplatePreviewDialog, type TemplatePreviewData } from "./template-preview";
import { NewTemplateWizardModal, TemplateWizardModal, type SystemSourceData } from "./new-template-wizard-modal";

const SYSTEM_META_TEMPLATE_LABELS: Record<SystemMetaTemplateKey, string> = {
  flowmedi_consulta: "Consulta",
  flowmedi_agenda_com_formulario: "Consulta com formulário",
  flowmedi_formulario: "Formulário",
  flowmedi_aviso: "Aviso",
  flowmedi_mensagem_livre: "Mensagem livre",
  flowmedi_confirmacao_flow: "Confirmação com Flow (Sim / Não / Remarcar)",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

function channelIcon(channel: string) {
  return channel === "email" ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />;
}

function toPreviewDataFromSaved(t: MessageTemplate): TemplatePreviewData {
  return {
    name: t.name,
    channel: t.channel,
    subject: t.subject,
    body_html: t.body_html,
    body_text: t.body_text,
    email_header: t.email_header,
    email_footer: t.email_footer,
  };
}

function toPreviewDataFromSystem(t: EffectiveTemplateItem): TemplatePreviewData {
  return {
    name: t.event_name,
    channel: t.channel,
    subject: t.subject,
    body_html: t.body_html,
    body_text: t.body_text,
  };
}

function toSystemSource(t: EffectiveTemplateItem): SystemSourceData {
  return {
    eventCode: t.event_code,
    channel: t.channel,
    name: t.name,
    subject: t.subject,
    body_html: t.body_html,
    body_text: t.body_text,
    whatsapp_meta_phrase: t.whatsapp_meta_phrase,
  };
}

function bodySnippet(html: string, text?: string | null) {
  const raw = text?.trim() || html.replace(/<[^>]*>/g, "").trim();
  return raw.slice(0, 120) + (raw.length > 120 ? "…" : "");
}

export function TemplatesListClient({
  savedTemplates,
  systemTemplates,
  remoteMetaTemplates,
  systemMetaTemplates = [],
  hasWhatsAppIntegration,
  canCreateTemplates,
  canUseEmailTemplates,
  canUseWhatsAppTemplates,
  events = [],
  mode = "all",
  initialEditTemplate,
}: {
  savedTemplates: MessageTemplate[];
  systemTemplates: EffectiveTemplateItem[];
  remoteMetaTemplates: RemoteMetaTemplateItem[];
  systemMetaTemplates?: ClinicMetaTemplateStatus[];
  hasWhatsAppIntegration: boolean;
  canCreateTemplates: boolean;
  canUseEmailTemplates: boolean;
  canUseWhatsAppTemplates: boolean;
  events?: MessageEvent[];
  mode?: "all" | "saved" | "system" | "metaApproved" | "meta";
  initialEditTemplate?: MessageTemplate | null;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplatePreviewData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(!!initialEditTemplate);
  const [wizardMode, setWizardMode] = useState<"create" | "edit" | "fromSystem">(
    initialEditTemplate ? "edit" : "create"
  );
  const [editTemplate, setEditTemplate] = useState<MessageTemplate | null>(initialEditTemplate ?? null);
  const [systemSource, setSystemSource] = useState<SystemSourceData | null>(null);

  const [requestingSystemTemplates, setRequestingSystemTemplates] = useState(false);
  const [syncingSystemStatuses, setSyncingSystemStatuses] = useState(false);

  function openPreview(data: TemplatePreviewData) {
    setPreviewTemplate(data);
    setPreviewOpen(true);
  }

  function openEditWizard(template: MessageTemplate) {
    setWizardMode("edit");
    setEditTemplate(template);
    setSystemSource(null);
    setWizardOpen(true);
  }

  function openSystemWizard(template: EffectiveTemplateItem) {
    setWizardMode("fromSystem");
    setSystemSource(toSystemSource(template));
    setEditTemplate(null);
    setWizardOpen(true);
  }

  function handleWizardOpenChange(open: boolean) {
    setWizardOpen(open);
    if (!open) {
      setEditTemplate(null);
      setSystemSource(null);
      if (initialEditTemplate) {
        router.replace("/dashboard/mensagens/templates/salvos");
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja desativar este template?")) return;
    setDeleting(id);
    const result = await deactivateMessageTemplate(id);
    setDeleting(null);
    if (result.error) alert(`Erro: ${result.error}`);
    else router.refresh();
  }

  async function handleRequestSystemTemplates() {
    setRequestingSystemTemplates(true);
    const result = await requestSystemMetaTemplates();
    setRequestingSystemTemplates(false);
    if (result.error) alert(`Erro ao solicitar templates: ${result.error}`);
    router.refresh();
  }

  async function handleRefreshSystemStatuses() {
    setSyncingSystemStatuses(true);
    const result = await refreshSystemMetaTemplatesStatus();
    setSyncingSystemStatuses(false);
    if (result.error) alert(`Erro ao sincronizar status: ${result.error}`);
    router.refresh();
  }

  function displayTemplateName(rawName: string) {
    return rawName.replace(/_v\d+$/i, "");
  }

  function renderMetaStatusBadge(status: string | null | undefined) {
    const normalized = (status || "PENDING").toUpperCase();
    if (normalized === "APPROVED") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Meta: Approved</Badge>;
    if (normalized === "REJECTED") return <Badge variant="destructive">Meta: Rejected</Badge>;
    if (normalized === "DISABLED" || normalized === "PAUSED") return <Badge variant="secondary">Meta: {normalized}</Badge>;
    return <Badge variant="outline">Meta: {normalized}</Badge>;
  }

  const showSaved = mode === "all" || mode === "saved";
  const showSystem = mode === "all" || mode === "system";
  const showMeta = mode === "all" || mode === "metaApproved" || mode === "meta";
  const showSectionTitles = mode === "all";

  return (
    <div className="space-y-8">
      <TemplatePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} template={previewTemplate} />

      {(wizardMode === "edit" || wizardMode === "fromSystem") && (
        <TemplateWizardModal
          events={events}
          canUseEmailTemplates={canUseEmailTemplates}
          canUseWhatsAppTemplates={canUseWhatsAppTemplates}
          mode={wizardMode}
          templateId={editTemplate?.id}
          initialTemplate={editTemplate ?? undefined}
          systemSource={systemSource ?? undefined}
          open={wizardOpen}
          onOpenChange={handleWizardOpenChange}
          hideTrigger
        />
      )}

      {showSaved && (
        <section>
          {showSectionTitles && (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-2">Templates salvos</h2>
              <p className="text-sm text-muted-foreground mb-4">Os que você configurou ou editou.</p>
            </>
          )}
          {savedTemplates.length === 0 ? (
            <Card className="p-6">
              <p className="text-muted-foreground mb-4">Nenhum template criado ainda.</p>
              {canCreateTemplates ? (
                <NewTemplateWizardModal
                  events={events}
                  canUseEmailTemplates={canUseEmailTemplates}
                  canUseWhatsAppTemplates={canUseWhatsAppTemplates}
                  triggerLabel="Criar template"
                />
              ) : (
                <Button variant="outline" disabled>
                  Criar template
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {savedTemplates.map((t) => (
                <Card
                  key={t.id}
                  className="group flex flex-col hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                          {channelIcon(t.channel)}
                        </div>
                        <Badge variant="secondary">{CHANNEL_LABELS[t.channel]}</Badge>
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2">{t.name}</CardTitle>
                    <CardDescription className="text-xs">{t.event_code}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 pb-3">
                    {t.subject && (
                      <p className="text-xs text-muted-foreground mb-2">
                        <span className="font-medium text-foreground">Assunto:</span> {t.subject}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {bodySnippet(t.body_html, t.body_text)}
                    </p>
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2 pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPreview(toPreviewDataFromSaved(t))}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Visualizar
                    </Button>
                    {canCreateTemplates ? (
                      <>
                        <Button variant="default" size="sm" onClick={() => openEditWizard(t)}>
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(t.id)}
                          disabled={deleting === t.id}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Desativar
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        Visualização
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {showSystem && (
        <section>
          {showSectionTitles && (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-2">Templates do sistema</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Padrão por evento (Email e WhatsApp separados). Use &quot;Usar e editar&quot; para copiar e personalizar.
              </p>
            </>
          )}
          {systemTemplates.length === 0 ? (
            <Card className="p-6">
              <p className="text-muted-foreground">
                Nenhum template do sistema disponível. Execute a migration dos templates do sistema.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {systemTemplates.map((t) => {
                const channelAllowed =
                  t.channel === "email" ? canUseEmailTemplates : canUseWhatsAppTemplates;
                return (
                  <Card
                    key={`${t.event_code}:${t.channel}`}
                    className="group flex flex-col bg-muted/20 hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                            {channelIcon(t.channel)}
                          </div>
                          <Badge variant="outline">{CHANNEL_LABELS[t.channel]}</Badge>
                        </div>
                      </div>
                      <CardTitle className="text-base mt-2">{t.event_name}</CardTitle>
                      <CardDescription className="text-xs">{t.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-3">
                      {t.subject && (
                        <p className="text-xs text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">Assunto:</span> {t.subject}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {t.body_preview}
                      </p>
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2 pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPreview(toPreviewDataFromSystem(t))}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Visualizar
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={!channelAllowed}
                        onClick={() => openSystemWizard(t)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Usar e editar
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {showMeta && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Templates aprovados pela Meta</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Solicite os templates padrão uma única vez para permitir envios fora da janela de 24h.
            O pacote inclui consulta, formulário, avisos e confirmação com Flow (Sim / Não / Remarcar).
          </p>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button
                type="button"
                onClick={handleRequestSystemTemplates}
                disabled={requestingSystemTemplates || !canUseWhatsAppTemplates}
              >
                {requestingSystemTemplates ? "Solicitando..." : "Solicitar templates do sistema"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRefreshSystemStatuses}
                disabled={syncingSystemStatuses || !canUseWhatsAppTemplates}
              >
                <RefreshCcw className="h-3 w-3 mr-1" />
                {syncingSystemStatuses ? "Sincronizando..." : "Atualizar status"}
              </Button>
            </div>
            {systemMetaTemplates.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Status dos templates do sistema</p>
                <div className="space-y-2">
                  {systemMetaTemplates.map((tpl) => (
                    <div
                      key={tpl.template_key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border p-2"
                    >
                      <div className="text-xs">
                        <p className="font-medium">{SYSTEM_META_TEMPLATE_LABELS[tpl.template_key]}</p>
                        <p className="text-muted-foreground font-mono">{tpl.template_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {renderMetaStatusBadge(tpl.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-1">
              <p className="text-sm font-medium mb-2">Templates existentes na Meta (tempo real)</p>
              {remoteMetaTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {hasWhatsAppIntegration
                    ? "Nenhum template retornado pela Meta no momento."
                    : "Faça a integração para ver os templates de mensagens."}
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto pr-1">
                  {remoteMetaTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border p-2"
                    >
                      <div className="text-xs">
                        <p className="font-medium">{displayTemplateName(tpl.name)}</p>
                        <p className="text-muted-foreground font-mono">{tpl.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {tpl.language && <Badge variant="outline">{tpl.language}</Badge>}
                        {renderMetaStatusBadge(tpl.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
