"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { Loader2, Trash2 } from "lucide-react";
import { getEditWindowRemainingMs, MAX_SUGGESTION_LENGTH, sanitizeSuggestionContent } from "@/lib/public-suggestions";

type Suggestion = {
  id: string;
  content: string;
  created_at: string;
};

type TokenGetResponse = {
  suggestion: Suggestion;
  editable: boolean;
  remaining_ms: number;
};

export function EditTokenClient({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [editable, setEditable] = useState(false);
  const [content, setContent] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void loadSuggestion();
  }, [token]);

  async function loadSuggestion() {
    setLoading(true);
    try {
      const response = await fetch(`/api/public-suggestions/token/${token}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as TokenGetResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível abrir o link de edição.");
      }

      setSuggestion(payload.suggestion);
      setEditable(payload.editable);
      setContent(payload.suggestion.content);
      localStorage.setItem(`suggestion_${payload.suggestion.id}`, token);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Não foi possível abrir o link de edição.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!suggestion) return;

    const sanitized = sanitizeSuggestionContent(content);
    if (!sanitized) {
      toast("A sugestão não pode ficar vazia.", "error");
      return;
    }

    if (sanitized.length > MAX_SUGGESTION_LENGTH) {
      toast(`Limite de ${MAX_SUGGESTION_LENGTH} caracteres excedido.`, "error");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/public-suggestions/token/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: sanitized }),
      });
      const payload = (await response.json()) as
        | { suggestion: Suggestion; error?: string }
        | { error?: string };

      if (!response.ok || !("suggestion" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Erro ao salvar alteração.");
      }

      setSuggestion(payload.suggestion);
      setContent(payload.suggestion.content);
      setEditable(getEditWindowRemainingMs(payload.suggestion.created_at) > 0);
      toast("Sugestão atualizada com sucesso.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao salvar alteração.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!suggestion) return;
    setDeleting(true);

    try {
      const response = await fetch(`/api/public-suggestions/token/${token}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Erro ao excluir sugestão.");
      }

      localStorage.removeItem(`suggestion_${suggestion.id}`);
      toast("Sugestão excluída com sucesso.", "success");
      router.push("/sugestoes");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro ao excluir sugestão.", "error");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando sugestão...
        </CardContent>
      </Card>
    );
  }

  if (!suggestion) {
    return (
      <Card>
        <CardHeader>
          <h1 className="text-lg font-semibold">Link de edição inválido</h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O link pode estar incorreto, expirado ou a sugestão já foi removida.
          </p>
          <Button onClick={() => router.push("/sugestoes")}>Ir para Sugestões & Melhorias</Button>
        </CardContent>
      </Card>
    );
  }

  const remainingMs = getEditWindowRemainingMs(suggestion.created_at, nowMs);
  const canEdit = editable && remainingMs > 0;

  return (
    <>
      <Card>
        <CardHeader className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Editar sugestão</h1>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? `Você pode editar por mais ${Math.floor(remainingMs / 60000)}:${String(
                  Math.floor((remainingMs % 60000) / 1000)
                ).padStart(2, "0")}`
              : "Tempo de edição expirado. Essa sugestão não pode mais ser alterada."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={7}
            maxLength={MAX_SUGGESTION_LENGTH}
            disabled={!canEdit}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void handleSave()} disabled={!canEdit || saving}>
              {saving ? "Salvando..." : "Salvar alteração"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!canEdit || deleting}
              title={!canEdit ? "Tempo de edição expirado" : undefined}
            >
              <Trash2 className="h-4 w-4" />
              Excluir sugestão
            </Button>
            <Button variant="ghost" onClick={() => router.push("/sugestoes")}>
              Voltar para feed
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Excluir sugestão?"
        message="Essa ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!deleting) setShowDeleteConfirm(false);
        }}
        loading={deleting}
      />
    </>
  );
}
