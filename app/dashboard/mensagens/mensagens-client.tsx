"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getRecentMessageLog,
  getMessageLogById,
  type MessageLogEntry,
} from "./actions";
import { Mail, MessageSquare, Eye } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  SentEmailPreviewPanel,
  WhatsAppPreviewBubble,
} from "@/components/comunicacao/message-preview";

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

function formatSender(entry: MessageLogEntry) {
  if (entry.sender_type === "system") return "Sistema";
  const userLabel = entry.sender_name || entry.sender_email;
  const roleLabel =
    entry.sender_role === "admin"
      ? "Admin"
      : entry.sender_role === "secretaria"
        ? "Secretária"
        : entry.sender_role === "medico"
          ? "Profissional"
          : "Usuário";
  return userLabel ? `${roleLabel} (${userLabel})` : roleLabel;
}

function ChannelBadge({ channel }: { channel: string }) {
  const isEmail = channel === "email";
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 gap-1 text-xs font-medium",
        isEmail
          ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      )}
    >
      {isEmail ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
      {CHANNEL_LABELS[channel] ?? channel}
    </Badge>
  );
}

function MessageLogRow({
  entry,
  onPreview,
}: {
  entry: MessageLogEntry;
  onPreview: () => void;
}) {
  return (
    <li className="group rounded-lg border border-border/60 bg-card hover:bg-muted/20 transition-colors">
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            entry.channel === "email"
              ? "bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400"
              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
          )}
        >
          {entry.channel === "email" ? (
            <Mail className="h-4 w-4" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm truncate">
              {entry.patient_name ?? "Paciente"}
            </p>
            <ChannelBadge channel={entry.channel} />
          </div>

          <p className="text-xs text-muted-foreground">
            {formatDate(entry.sent_at)} · {entry.type}
          </p>

          {entry.channel === "email" && entry.subject && (
            <p className="text-xs text-muted-foreground truncate">
              Assunto: {entry.subject}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Enviado por: {formatSender(entry)}
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9 opacity-80 group-hover:opacity-100"
          onClick={onPreview}
          title="Ver preview"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

export function MensagensClient() {
  const [recentLog, setRecentLog] = useState<MessageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [fullHistory, setFullHistory] = useState<MessageLogEntry[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<MessageLogEntry | null>(null);

  const openPreview = async (entry: MessageLogEntry) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    const res = await getMessageLogById(entry.id);
    setPreviewEntry(res.data ?? entry);
    setPreviewLoading(false);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const logRes = await getRecentMessageLog(20);
      setRecentLog(logRes.data ?? []);
      const err = logRes.error;
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
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl truncate">
          Mensagens enviadas
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Histórico de mensagens automáticas e manuais (e-mail e WhatsApp). Use o menu
          Comunicação para inbox, pendentes e templates.
        </p>
      </div>

      <Card className="p-4 sm:p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4 min-w-0">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 truncate sm:text-lg">
            <Mail className="h-5 w-5 shrink-0" />
            <span className="truncate">Registro de envios</span>
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

        <div className="max-h-[65vh] overflow-y-auto overflow-x-hidden">
          {recentLog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhuma mensagem enviada ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentLog.map((entry) => (
                <MessageLogRow
                  key={entry.id}
                  entry={entry}
                  onPreview={() => void openPreview(entry)}
                />
              ))}
            </ul>
          )}
        </div>
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
                  <MessageLogRow
                    key={entry.id}
                    entry={entry}
                    onPreview={() => void openPreview(entry)}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          title="Mensagem real enviada"
          onClose={() => setPreviewOpen(false)}
          className={cn(
            "max-w-[96vw]",
            previewEntry?.channel === "email" ? "sm:max-w-3xl" : "sm:max-w-2xl"
          )}
        >
          {previewLoading ? (
            <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
          ) : !previewEntry ? (
            <p className="text-sm text-muted-foreground">Não foi possível carregar os detalhes.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-1 text-sm rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p>
                  <span className="text-muted-foreground">Paciente:</span>{" "}
                  {previewEntry.patient_name ?? "Paciente"}
                </p>
                <p>
                  <span className="text-muted-foreground">Data/hora:</span>{" "}
                  {formatDate(previewEntry.sent_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">Enviado por:</span>{" "}
                  {formatSender(previewEntry)}
                </p>
              </div>

              {previewEntry.channel === "email" && (
                <SentEmailPreviewPanel
                  subject={previewEntry.subject}
                  bodyHtml={previewEntry.body_html}
                  templateName={previewEntry.template_name}
                  legacyFallback={previewEntry.body_text}
                />
              )}

              {previewEntry.channel === "whatsapp" && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-medium">WhatsApp — {previewEntry.type}</p>
                    {previewEntry.template_name && (
                      <Badge variant="secondary" className="text-xs">
                        {previewEntry.template_name}
                      </Badge>
                    )}
                  </div>
                  <WhatsAppPreviewBubble
                    text={previewEntry.body_text || previewEntry.body_html || ""}
                    sentAt={previewEntry.sent_at}
                  />
                </Card>
              )}

              {!previewEntry.body_html &&
                !previewEntry.body_text &&
                !previewEntry.subject &&
                previewEntry.channel !== "whatsapp" && (
                  <pre className="text-xs p-3 rounded-md bg-muted overflow-auto max-h-[40vh]">
                    {JSON.stringify(previewEntry.metadata ?? {}, null, 2)}
                  </pre>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
