"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getEditWindowRemainingMs,
  MAX_SUGGESTION_LENGTH,
  sanitizeSuggestionContent,
  SPAM_COOLDOWN_MS,
  type PublicSuggestionPublic,
} from "@/lib/public-suggestions";

type SuggestionResponse = {
  suggestions: PublicSuggestionPublic[];
  total: number;
};

type CreateSuggestionResponse = {
  suggestion: PublicSuggestionPublic;
  edit_token: string;
  edit_link: string;
};

const LOCAL_STORAGE_PREFIX = "suggestion_";

function localStorageKey(id: string) {
  return `${LOCAL_STORAGE_PREFIX}${id}`;
}

function formatDateTime(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateIso));
}

function formatRemaining(remainingMs: number) {
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function SugestoesClient() {
  const [suggestions, setSuggestions] = useState<PublicSuggestionPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendCooldownUntil, setSendCooldownUntil] = useState(0);

  const [ownedTokens, setOwnedTokens] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PublicSuggestionPublic | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sendRemainingMs = Math.max(0, sendCooldownUntil - nowMs);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void loadSuggestions();
  }, []);

  useEffect(() => {
    if (suggestions.length === 0) {
      setOwnedTokens({});
      return;
    }

    const map: Record<string, string> = {};
    for (const suggestion of suggestions) {
      const token = localStorage.getItem(localStorageKey(suggestion.id));
      if (token) {
        map[suggestion.id] = token;
      }
    }
    setOwnedTokens(map);
  }, [suggestions]);

  const editableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const suggestion of suggestions) {
      if (!ownedTokens[suggestion.id]) continue;
      if (getEditWindowRemainingMs(suggestion.created_at, nowMs) > 0) {
        ids.add(suggestion.id);
      }
    }
    return ids;
  }, [suggestions, ownedTokens, nowMs]);

  async function loadSuggestions() {
    setLoadingFeed(true);
    try {
      const response = await fetch("/api/public-suggestions", { cache: "no-store" });
      const payload = (await response.json()) as SuggestionResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Erro ao carregar sugestões.");
      }

      setSuggestions(payload.suggestions ?? []);
      setTotal(payload.total ?? payload.suggestions?.length ?? 0);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao carregar sugestões.", "error");
    } finally {
      setLoadingFeed(false);
    }
  }

  async function handleSubmitSuggestion() {
    const sanitized = sanitizeSuggestionContent(content);
    if (!sanitized) {
      toast("Digite uma sugestão antes de enviar.", "error");
      return;
    }

    if (sanitized.length > MAX_SUGGESTION_LENGTH) {
      toast(`Limite de ${MAX_SUGGESTION_LENGTH} caracteres excedido.`, "error");
      return;
    }

    if (sendRemainingMs > 0) {
      toast("Aguarde alguns segundos antes de enviar novamente.", "info");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/public-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: sanitized }),
      });

      const payload = (await response.json()) as
        | (CreateSuggestionResponse & { error?: string; retry_after_ms?: number })
        | { error?: string; retry_after_ms?: number };

      if (!response.ok || !("suggestion" in payload)) {
        const retryAfter = "retry_after_ms" in payload ? payload.retry_after_ms : undefined;
        if (retryAfter && Number.isFinite(retryAfter) && retryAfter > 0) {
          setSendCooldownUntil(Date.now() + retryAfter);
        }
        throw new Error(("error" in payload && payload.error) || "Erro ao enviar sugestão.");
      }

      localStorage.setItem(localStorageKey(payload.suggestion.id), payload.edit_token);
      setOwnedTokens((prev) => ({ ...prev, [payload.suggestion.id]: payload.edit_token }));
      setSuggestions((prev) => [payload.suggestion, ...prev]);
      setTotal((prev) => prev + 1);
      setContent("");
      setSendCooldownUntil(Date.now() + SPAM_COOLDOWN_MS);

      toast("Sugestão enviada com sucesso.", "success");
      document.getElementById("feed-start")?.scrollIntoView({ behavior: "smooth", block: "start" });

      if (payload.edit_link) {
        const absoluteLink = `${window.location.origin}${payload.edit_link}`;
        try {
          await navigator.clipboard.writeText(absoluteLink);
          toast("Link secreto de edição copiado para a área de transferência.", "info");
        } catch {
          toast("Sugestão enviada. Copie o link secreto pelo botão do card.", "info");
        }
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao enviar sugestão.", "error");
    } finally {
      setSending(false);
    }
  }

  function startEdit(suggestion: PublicSuggestionPublic) {
    setEditingId(suggestion.id);
    setEditingContent(suggestion.content);
  }

  async function saveEdit(id: string) {
    const token = ownedTokens[id];
    if (!token) {
      toast("Token de edição não encontrado no navegador.", "error");
      return;
    }

    const sanitized = sanitizeSuggestionContent(editingContent);
    if (!sanitized) {
      toast("A sugestão não pode ficar vazia.", "error");
      return;
    }

    if (sanitized.length > MAX_SUGGESTION_LENGTH) {
      toast(`Limite de ${MAX_SUGGESTION_LENGTH} caracteres excedido.`, "error");
      return;
    }

    setSavingEdit(true);
    try {
      const response = await fetch(`/api/public-suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: sanitized,
          edit_token: token,
        }),
      });

      const payload = (await response.json()) as
        | { suggestion: PublicSuggestionPublic; error?: string }
        | { error?: string };

      if (!response.ok || !("suggestion" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Erro ao editar sugestão.");
      }

      setSuggestions((prev) =>
        prev.map((item) => (item.id === id ? payload.suggestion : item))
      );
      setEditingId(null);
      setEditingContent("");
      toast("Sugestão atualizada com sucesso.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao editar sugestão.", "error");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const token = ownedTokens[deleteTarget.id];
    if (!token) {
      toast("Token de edição não encontrado para apagar.", "error");
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/public-suggestions/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edit_token: token }),
      });

      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erro ao excluir sugestão.");
      }

      localStorage.removeItem(localStorageKey(deleteTarget.id));
      setOwnedTokens((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      setSuggestions((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setTotal((prev) => Math.max(0, prev - 1));
      setDeleteTarget(null);
      toast("Sugestão excluída com sucesso.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao excluir sugestão.", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_1.15fr]">
      <Card className="h-fit border-border/80">
        <CardHeader className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Nova sugestão</h2>
          <p className="text-sm text-muted-foreground">
            Descreva aqui uma melhoria, sugestão ou problema encontrado...
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Descreva aqui uma melhoria, sugestão ou problema encontrado..."
            rows={7}
            maxLength={MAX_SUGGESTION_LENGTH}
          />

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{content.trim().length}/{MAX_SUGGESTION_LENGTH} caracteres</span>
            {sendRemainingMs > 0 ? (
              <span className="rounded-full bg-muted px-2 py-1">
                Aguarde {formatRemaining(sendRemainingMs)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSubmitSuggestion} disabled={sending || sendRemainingMs > 0}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar sugestão
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div id="feed-start" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Feed de sugestões</h2>
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
            {total} no total
          </span>
        </div>

        {loadingFeed ? (
          <Card className="border-border/80">
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando sugestões...
            </CardContent>
          </Card>
        ) : suggestions.length === 0 ? (
          <Card className="border-dashed border-border/80">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Nenhuma sugestão enviada ainda. Seja o primeiro a contribuir.
            </CardContent>
          </Card>
        ) : (
          suggestions.map((suggestion) => {
            const token = ownedTokens[suggestion.id];
            const remainingMs = getEditWindowRemainingMs(suggestion.created_at, nowMs);
            const isEditable = Boolean(token) && editableIds.has(suggestion.id);
            const isEditing = editingId === suggestion.id;

            return (
              <Card key={suggestion.id} className="border-border/80 shadow-sm">
                <CardContent className="space-y-4 py-5">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(suggestion.created_at)}
                    </p>
                    {isEditing ? (
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={4}
                        maxLength={MAX_SUGGESTION_LENGTH}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {suggestion.content}
                      </p>
                    )}
                  </div>

                  {token ? (
                    <div className="space-y-3">
                      <p
                        className={cn(
                          "text-xs",
                          remainingMs > 0 ? "text-emerald-600" : "text-muted-foreground"
                        )}
                      >
                        {remainingMs > 0
                          ? `Você pode editar por mais ${formatRemaining(remainingMs)}`
                          : "Tempo de edição expirado"}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => void saveEdit(suggestion.id)}
                              disabled={savingEdit || !isEditable}
                              title={!isEditable ? "Tempo de edição expirado" : undefined}
                            >
                              {savingEdit ? "Salvando..." : "Salvar alteração"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingEdit}
                              onClick={() => {
                                setEditingId(null);
                                setEditingContent("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(suggestion)}
                              disabled={!isEditable}
                              title={!isEditable ? "Tempo de edição expirado" : undefined}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteTarget(suggestion)}
                              disabled={!isEditable}
                              title={!isEditable ? "Tempo de edição expirado" : undefined}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Apagar
                            </Button>
                          </>
                        )}

                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir sugestão?"
        message="Essa ação remove a sugestão permanentemente."
        confirmLabel="Apagar sugestão"
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        loading={deleting}
      />
    </div>
  );
}
