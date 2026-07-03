"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConversationPipelineState } from "@/lib/virtual-assistant/conversation-pipeline-state";

type UseConversationPipelineOptions = {
  /** Polling interval in ms; 0 = disabled */
  pollIntervalMs?: number;
};

export function useConversationPipeline(
  conversationId: string | null,
  opts: UseConversationPipelineOptions = {}
) {
  const { pollIntervalMs = 0 } = opts;
  const [data, setData] = useState<ConversationPipelineState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/whatsapp/assistant/conversation-pipeline?conversationId=${encodeURIComponent(conversationId)}`
      );
      const json = (await res.json()) as ConversationPipelineState & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Erro ao carregar pipeline");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Falha ao carregar pipeline da conversa");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!conversationId || pollIntervalMs <= 0) return;
    const interval = setInterval(() => void refresh(), pollIntervalMs);
    return () => clearInterval(interval);
  }, [conversationId, pollIntervalMs, refresh]);

  return { data, loading, error, refresh };
}
