"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getRecentMessageLog,
  getMessageLogById,
  type MessageLogEntry,
} from "./actions";
import { Mail, MessageSquare, Plus, FileText, Eye } from "lucide-react";
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

function formatSender(entry: MessageLogEntry) {
  if (entry.sender_type === "system") return "Sistema";
  const userLabel = entry.sender_name || entry.sender_email;
  return userLabel ? `Usuário (${userLabel})` : "Usuário";
}

function WhatsAppPreviewBubble({ body }: { body: string }) {
  const plainText = body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-xl border border-border bg-[#d1ccc6] dark:bg-[#0b141a] p-4 shadow-inner max-w-[96%]">
      <div className="flex flex-col gap-1">
        <div className="rounded-lg px-3 py-2 shadow-md max-w-[320px] bg-[#c6e7b8] dark:bg-[#005c4b]">
          <p className="text-sm text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap break-words">{plainText}</p>
          <p className="text-[10px] text-[#667781] dark:text-[#8696a0] text-right mt-1">{timeStr}</p>
        </div>
      </div>
    </div>
  );
}

export function MensagensClient() {
  const router = useRouter();
  const [recentLog, setRecentLog] = useState<MessageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl truncate">Mensagens</h1>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-none">
            Configurações rápidas e histórico de mensagens enviadas
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
            onClick={() => router.push("/dashboard/mensagens/templates/novo")}
          >
            <Plus className="h-4 w-4 mr-2 shrink-0" />
            Criar Template
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2 sm:text-lg">
            <Mail className="h-5 w-5 shrink-0" />
            Configurações de email
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure envio de teste, cabeçalho e rodapé em uma página dedicada.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/mensagens/email")}
            className="w-full sm:w-auto min-h-[44px] touch-manipulation"
          >
            Abrir configurações de email
          </Button>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2 sm:text-lg">
            <FileText className="h-5 w-5 shrink-0" />
            Templates
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Crie e edite templates em Mensagens/Templates.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/mensagens/templates")}
            className="w-full sm:w-auto min-h-[44px] touch-manipulation"
          >
            Ir para mensagens/templates
          </Button>
        </Card>
      </div>

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
        <div className="max-h-[65vh] overflow-y-auto overflow-x-hidden space-y-2">
          {recentLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</p>
          ) : (
            <ul className="space-y-2">
              {recentLog.map((entry) => (
                <li
                  key={entry.id}
                  className="text-sm flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <span className="truncate block font-medium">
                      {entry.patient_name ?? "Paciente"} · {CHANNEL_LABELS[entry.channel] ?? entry.channel}
                    </span>
                    <span className="text-muted-foreground text-xs block">
                      {formatDate(entry.sent_at)} · tipo: {entry.type}
                    </span>
                    <span className="text-muted-foreground text-xs block">
                      Enviado por: {formatSender(entry)}
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
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                </li>
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
                  <li key={entry.id} className="border rounded-md p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.patient_name ?? "Paciente"} · {CHANNEL_LABELS[entry.channel] ?? entry.channel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.sent_at)} · tipo: {entry.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Enviado por: {formatSender(entry)}
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
        <DialogContent
          title="Mensagem real enviada"
          onClose={() => setPreviewOpen(false)}
          className="max-w-[96vw] sm:max-w-2xl"
        >
          {previewLoading ? (
            <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
          ) : !previewEntry ? (
            <p className="text-sm text-muted-foreground">Não foi possível carregar os detalhes.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1 text-sm">
                <p><strong>Paciente:</strong> {previewEntry.patient_name ?? "Paciente"}</p>
                <p><strong>Data/hora:</strong> {formatDate(previewEntry.sent_at)}</p>
                <p><strong>Enviado por:</strong> {formatSender(previewEntry)}</p>
              </div>

              {previewEntry.channel === "email" && (
                <div className="rounded-md border border-border p-3 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email — {previewEntry.type}
                  </p>
                  <div>
                    <p className="text-xs text-muted-foreground">Assunto</p>
                    <p className="text-sm rounded bg-muted/50 p-2">{previewEntry.subject || "(sem assunto)"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Corpo</p>
                    <div className="rounded bg-muted/50 p-3 max-h-[45vh] overflow-auto">
                      {previewEntry.body_html ? (
                        <div
                          className="text-sm prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: previewEntry.body_html }}
                        />
                      ) : (
                        <pre className="text-xs whitespace-pre-wrap">{previewEntry.body_text || "(sem conteúdo)"}</pre>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {previewEntry.channel === "whatsapp" && (
                <div className="rounded-md border border-border p-3 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp — {previewEntry.type}
                  </p>
                  <WhatsAppPreviewBubble body={previewEntry.body_text || previewEntry.body_html || ""} />
                </div>
              )}

              {!previewEntry.body_html && !previewEntry.body_text && !previewEntry.subject && previewEntry.channel !== "whatsapp" && (
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
