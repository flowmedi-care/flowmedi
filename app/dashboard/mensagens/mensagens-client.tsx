"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MessageEvent,
  ClinicMessageSetting,
  MessageTemplate,
  getMessageEvents,
  getClinicMessageSettings,
  getMessageTemplates,
  getSystemTemplatesForDisplay,
  getRecentMessageLog,
  getMessageLogById,
  createMessageTemplateFromSystem,
  type MessageLogEntry,
  type EffectiveTemplateItem,
} from "./actions";
import { Mail, MessageSquare, Plus, FileText, Edit, Copy, Send, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export function MensagensClient() {
  const router = useRouter();
  const [events, setEvents] = useState<MessageEvent[]>([]);
  const [settings, setSettings] = useState<ClinicMessageSetting[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<MessageTemplate[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<EffectiveTemplateItem[]>([]);
  const [recentLog, setRecentLog] = useState<MessageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingSystemId, setUsingSystemId] = useState<string | null>(null);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [fullHistory, setFullHistory] = useState<MessageLogEntry[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<MessageLogEntry | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [eventsRes, settingsRes, savedRes, systemRes, logRes] = await Promise.all([
        getMessageEvents(),
        getClinicMessageSettings(),
        getMessageTemplates(),
        getSystemTemplatesForDisplay(),
        getRecentMessageLog(12),
      ]);
      setEvents(eventsRes.data ?? []);
      setSettings(settingsRes.data ?? []);
      setSavedTemplates(savedRes.data ?? []);
      setSystemTemplates(systemRes.data ?? []);
      setRecentLog(logRes.data ?? []);
      const err =
        eventsRes.error ??
        settingsRes.error ??
        savedRes.error ??
        systemRes.error ??
        logRes.error;
      if (err) setLoadError(err);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Erro ao carregar"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSettingsChange = useCallback((next: ClinicMessageSetting[]) => {
    setSettings(next);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-destructive">{loadError}</p>
        <Button variant="outline" onClick={loadData}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl truncate">
            Mensagens
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-none">
            Histórico, eventos e templates de email e WhatsApp
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap shrink-0">
          <Button
            variant="outline"
            className="w-full sm:w-auto min-h-[44px] touch-manipulation"
            onClick={() => router.push("/dashboard/mensagens/pendentes")}
          >
            Mensagens Pendentes
          </Button>
          <Button
            className="w-full sm:w-auto min-h-[44px] touch-manipulation"
            onClick={() => router.push("/dashboard/mensagens/templates")}
          >
            <Plus className="h-4 w-4 mr-2 shrink-0" />
            Criar Template
          </Button>
        </div>
      </div>

      {/* Testar envio de email */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2 sm:text-lg">
          <Mail className="h-5 w-5 shrink-0" />
          Testar envio de email
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Escolha um destinatário e envie um email de teste para verificar se a integração com o Gmail está funcionando.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-2 w-full sm:min-w-[200px] sm:max-w-[280px]">
            <Label htmlFor="test-email-to">Destinatário (email)</Label>
            <Input
              id="test-email-to"
              type="email"
              placeholder="email@exemplo.com"
              value={testEmailTo}
              onChange={(e) => {
                setTestEmailTo(e.target.value);
                setTestEmailResult(null);
              }}
            />
          </div>
          <Button
            disabled={!testEmailTo.trim() || testEmailSending}
            className="w-full sm:w-auto min-h-[44px] touch-manipulation"
            onClick={async () => {
              setTestEmailSending(true);
              setTestEmailResult(null);
              try {
                const res = await fetch("/api/integrations/email/test", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: testEmailTo.trim(),
                    subject: "Teste FlowMedi",
                    body: "Este é um email de teste enviado pelo FlowMedi. Se você recebeu esta mensagem, a integração com o Gmail está funcionando.",
                  }),
                });
                const data = await res.json();
                if (res.ok && data.success) {
                  setTestEmailResult({ ok: true, message: "Email enviado com sucesso!" });
                  loadData();
                } else {
                  setTestEmailResult({ ok: false, message: data.error || "Erro ao enviar." });
                }
              } catch {
                setTestEmailResult({ ok: false, message: "Erro de conexão." });
              } finally {
                setTestEmailSending(false);
              }
            }}
          >
            {testEmailSending ? (
              "Enviando..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar email de teste
              </>
            )}
          </Button>
        </div>
        {testEmailResult && (
          <p
            className={`mt-3 text-sm ${testEmailResult.ok ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
          >
            {testEmailResult.message}
          </p>
        )}
      </Card>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Mini dashboard: histórico recente */}
        <Card className="p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center justify-between mb-4 min-w-0">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 truncate sm:text-lg">
              <Mail className="h-5 w-5 shrink-0" />
              <span className="truncate">Histórico de mensagens enviadas</span>
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[36px]"
              onClick={async () => {
                setHistoryOpen(true);
                setHistoryLoading(true);
                const res = await getRecentMessageLog(100);
                setFullHistory(res.data ?? []);
                setHistoryLoading(false);
              }}
            >
              Ver tudo
            </Button>
          </div>
          <div className="max-h-48 sm:max-h-64 overflow-y-auto overflow-x-hidden space-y-2">
            {recentLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma mensagem enviada ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentLog.map((entry) => (
                  <li
                    key={entry.id}
                    className="text-sm flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="truncate block">
                        {entry.patient_name ?? "Paciente"} ·{" "}
                        {CHANNEL_LABELS[entry.channel] ?? entry.channel}
                      </span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {formatDate(entry.sent_at)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={async () => {
                        setPreviewOpen(true);
                        setPreviewLoading(true);
                        const res = await getMessageLogById(entry.id);
                        setPreviewEntry(res.data ?? entry);
                        setPreviewLoading(false);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

      </div>

      {/* 1. Templates salvos (configurados/editados pelos usuários) */}
      <Card className="p-4 sm:p-5 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 sm:text-lg">
            <FileText className="h-5 w-5 shrink-0" />
            Templates salvos
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto min-h-[44px] sm:min-h-9 touch-manipulation"
            onClick={() => router.push("/dashboard/mensagens/templates")}
          >
            Ver todos
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Os que você configurou ou editou (aparecem aqui).
        </p>
        {savedTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">
            Nenhum template criado ainda. Crie um ou use um dos templates do sistema abaixo.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {savedTemplates.slice(0, 6).map((t) => (
              <li key={t.id}>
                <div className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors flex flex-col gap-2">
                  <span className="font-medium text-sm text-foreground block truncate">{t.name}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {t.channel === "email" ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                    {CHANNEL_LABELS[t.channel]} · {t.event_code}
                  </span>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {(t.body_html || "").replace(/<[^>]*>/g, "").slice(0, 60)}…
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/mensagens/templates/${t.id}/editar`)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {savedTemplates.length > 6 && (
          <p className="text-xs text-muted-foreground mt-2">
            Mostrando 6 de {savedTemplates.length}.{" "}
            <button type="button" className="underline" onClick={() => router.push("/dashboard/mensagens/templates")}>
              Ver todos
            </button>
          </p>
        )}
        <Button
          variant="outline"
          className="mt-4 w-full sm:w-auto min-h-[44px] touch-manipulation"
          onClick={() => router.push("/dashboard/mensagens/templates/novo")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Criar template
        </Button>
      </Card>

      {/* 2. Templates do sistema (padrões por evento/canal) */}
      <Card className="p-4 sm:p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4 min-w-0">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 truncate sm:text-lg">
            <FileText className="h-5 w-5 shrink-0" />
            Templates do sistema
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Padrão para cada evento (Email e WhatsApp separados). Use “Usar e editar” para copiar para os seus templates e personalizar.
        </p>
        {systemTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum template do sistema disponível. Execute a migration <code className="text-xs">migration-system-templates-and-email-header-footer.sql</code>.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {systemTemplates.slice(0, 12).map((t) => (
              <li key={`${t.event_code}:${t.channel}`}>
                <div className="p-3 rounded-lg border border-border bg-muted/20 flex flex-col gap-2">
                  <span className="font-medium text-sm text-foreground block truncate">{t.event_name}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {t.channel === "email" ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                    {CHANNEL_LABELS[t.channel]}
                  </span>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.body_preview}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={usingSystemId === `${t.event_code}:${t.channel}`}
                    onClick={async () => {
                      setUsingSystemId(`${t.event_code}:${t.channel}`);
                      const res = await createMessageTemplateFromSystem(t.event_code, t.channel);
                      setUsingSystemId(null);
                      if (res.error) {
                        alert(res.error);
                        return;
                      }
                      if (res.data?.id) router.push(`/dashboard/mensagens/templates/${res.data.id}/editar`);
                      else loadData();
                    }}
                  >
                    {usingSystemId === `${t.event_code}:${t.channel}` ? "..." : <Copy className="h-3 w-3 mr-1" />}
                    Usar e editar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {systemTemplates.length > 12 && (
          <p className="text-xs text-muted-foreground mt-2">
            Mostrando 12 de {systemTemplates.length}.{" "}
            <button type="button" className="underline" onClick={() => router.push("/dashboard/mensagens/templates")}>
              Ver todos
            </button>
          </p>
        )}
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent title="Histórico completo de mensagens" onClose={() => setHistoryOpen(false)}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            ) : fullHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada.</p>
            ) : (
              <ul className="space-y-2">
                {fullHistory.map((entry) => (
                  <li key={entry.id} className="border rounded-md p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.patient_name ?? "Paciente"} ·{" "}
                          {CHANNEL_LABELS[entry.channel] ?? entry.channel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.sent_at)} · tipo: {entry.type}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setPreviewOpen(true);
                          setPreviewLoading(true);
                          const res = await getMessageLogById(entry.id);
                          setPreviewEntry(res.data ?? entry);
                          setPreviewLoading(false);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent title="Preview da mensagem enviada" onClose={() => setPreviewOpen(false)}>
          {previewLoading ? (
            <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
          ) : !previewEntry ? (
            <p className="text-sm text-muted-foreground">Não foi possível carregar os detalhes.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>Paciente:</strong> {previewEntry.patient_name ?? "Paciente"}
              </p>
              <p className="text-sm">
                <strong>Canal:</strong> {CHANNEL_LABELS[previewEntry.channel] ?? previewEntry.channel}
              </p>
              <p className="text-sm">
                <strong>Data/hora:</strong> {formatDate(previewEntry.sent_at)}
              </p>
              <p className="text-sm">
                <strong>Tipo:</strong> {previewEntry.type}
              </p>
              <div>
                <p className="text-sm font-medium mb-2">Payload registrado</p>
                <pre className="text-xs p-3 rounded-md bg-muted overflow-auto max-h-[40vh]">
                  {JSON.stringify(previewEntry.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
