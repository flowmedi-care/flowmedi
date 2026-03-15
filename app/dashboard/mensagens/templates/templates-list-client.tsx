"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Edit, Trash2, Copy, RefreshCcw } from "lucide-react";
import {
  createMessageTemplateFromSystem,
  deactivateMessageTemplate,
  refreshSystemMetaTemplatesStatus,
  requestSystemMetaTemplates,
  type EffectiveTemplateItem,
  type MessageTemplate,
  type RemoteMetaTemplateItem,
} from "../actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
};

export function TemplatesListClient({
  savedTemplates,
  systemTemplates,
  remoteMetaTemplates,
  hasWhatsAppIntegration,
  canCreateTemplates,
  canUseEmailTemplates,
  canUseWhatsAppTemplates,
  mode = "all",
}: {
  savedTemplates: MessageTemplate[];
  systemTemplates: EffectiveTemplateItem[];
  remoteMetaTemplates: RemoteMetaTemplateItem[];
  hasWhatsAppIntegration: boolean;
  canCreateTemplates: boolean;
  canUseEmailTemplates: boolean;
  canUseWhatsAppTemplates: boolean;
  mode?: "all" | "saved" | "system" | "metaApproved" | "meta";
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [usingSystemId, setUsingSystemId] = useState<string | null>(null);
  const [requestingSystemTemplates, setRequestingSystemTemplates] = useState(false);
  const [syncingSystemStatuses, setSyncingSystemStatuses] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja desativar este template?")) return;
    setDeleting(id);
    const result = await deactivateMessageTemplate(id);
    setDeleting(null);
    if (result.error) alert(`Erro: ${result.error}`);
    else router.refresh();
  }

  async function handleUseSystem(t: EffectiveTemplateItem) {
    const key = `${t.event_code}:${t.channel}`;
    setUsingSystemId(key);
    const res = await createMessageTemplateFromSystem(t.event_code, t.channel);
    setUsingSystemId(null);
    if (res.error) {
      alert(res.error);
      return;
    }
    if (res.data?.id) router.push(`/dashboard/mensagens/templates/${res.data.id}/editar`);
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
      {/* 1. Templates salvos (configurados/editados pelos usuários) */}
      {showSaved && <section>
        {showSectionTitles && (
          <>
            <h2 className="text-lg font-semibold text-foreground mb-2">Templates salvos</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Os que você configurou ou editou.
            </p>
          </>
        )}
        {savedTemplates.length === 0 ? (
          <Card className="p-6">
            <p className="text-muted-foreground mb-4">Nenhum template criado ainda.</p>
            {canCreateTemplates ? (
              <Link href="/dashboard/mensagens/templates/novo">
                <Button>Criar template</Button>
              </Link>
            ) : (
              <Button variant="outline" disabled>
                Criar template
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedTemplates.map((t) => (
              <Card key={t.id} className="p-4">
                <h3 className="font-medium text-foreground">{t.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {CHANNEL_ICONS[t.channel]}
                  {CHANNEL_LABELS[t.channel]} · {t.event_code}
                </div>
                {t.subject && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>Assunto:</strong> {t.subject}
                  </p>
                )}
                <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {(t.body_html || "").replace(/<[^>]*>/g, "").slice(0, 100)}…
                </div>
                <div className="flex gap-2 mt-4">
                  {canCreateTemplates ? (
                    <>
                      <Link href={`/dashboard/mensagens/templates/${t.id}/editar`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                      </Link>
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
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>}

      {/* 2. Templates do sistema */}
      {showSystem && <section>
        {showSectionTitles && (
          <>
            <h2 className="text-lg font-semibold text-foreground mb-2">Templates do sistema</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Padrão por evento (Email e WhatsApp separados). Use “Usar e editar” para copiar e personalizar.
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
            {systemTemplates.map((t) => (
              <Card key={`${t.event_code}:${t.channel}`} className="p-4 bg-muted/20">
                <h3 className="font-medium text-foreground">{t.event_name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {CHANNEL_ICONS[t.channel]}
                  {CHANNEL_LABELS[t.channel]}
                </div>
                {t.subject && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>Assunto:</strong> {t.subject}
                  </p>
                )}
                <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {t.body_preview}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  disabled={
                    usingSystemId === `${t.event_code}:${t.channel}` ||
                    (t.channel === "email" ? !canUseEmailTemplates : !canUseWhatsAppTemplates)
                  }
                  onClick={() => handleUseSystem(t)}
                >
                  {usingSystemId === `${t.event_code}:${t.channel}` ? "..." : <Copy className="h-3 w-3 mr-1" />}
                  Usar e editar
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>}

      {/* 3. Templates Meta canônicos (por clínica) */}
      {showMeta && <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">Templates aprovados pela Meta</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Solicite os templates padrão uma única vez para permitir envios fora da janela de 24h.
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
                  <div key={tpl.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
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
      </section>}
    </div>
  );
}
