"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlaygroundCatalog } from "@/lib/virtual-assistant/tools/playground-catalog";

export function usePlaygroundCatalog() {
  const [catalog, setCatalog] = useState<PlaygroundCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/whatsapp/assistant/playground/catalog");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao carregar catálogo");
        if (!cancelled) setCatalog(json as PlaygroundCatalog);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading, error };
}

export type PhoneContext = {
  phone: string;
  patient: {
    id: string;
    full_name: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  conversationId: string | null;
  aiState: Record<string, unknown> | null;
  appointments: Array<{
    id: string;
    scheduled_at: string;
    status: string;
    doctor_name: string | null;
    procedure_name: string | null;
  }>;
};

export function usePhoneContext(phone: string) {
  const [context, setContext] = useState<PhoneContext | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (phoneValue: string) => {
    const trimmed = phoneValue.trim();
    if (!trimmed) {
      setContext(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/whatsapp/assistant/playground/context?phone=${encodeURIComponent(trimmed)}`
      );
      const json = await res.json();
      if (res.ok) setContext(json as PhoneContext);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(phone), 500);
    return () => clearTimeout(timer);
  }, [phone, refresh]);

  return { context, loading, refresh };
}
