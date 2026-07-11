"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "flowmedi-tool-playground-history";
const MAX_ENTRIES = 50;

export type PlaygroundHistoryEntry = {
  id: string;
  at: string;
  toolName: string;
  phone: string;
  conversationId: string;
  executorMode: "production" | "full";
  args: Record<string, unknown>;
  aiStateBefore: Record<string, unknown>;
  aiStateAfter: Record<string, unknown>;
  result: unknown;
  statePatch: Record<string, unknown> | null;
  durationMs: number;
  handoff: boolean;
  debug?: Record<string, unknown>;
  formValues: Record<string, string>;
};

function loadFromStorage(): PlaygroundHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PlaygroundHistoryEntry[];
  } catch {
    return [];
  }
}

export function usePlaygroundHistory() {
  const [history, setHistory] = useState<PlaygroundHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadFromStorage());
  }, []);

  const addEntry = useCallback((entry: Omit<PlaygroundHistoryEntry, "id" | "at">) => {
    const full: PlaygroundHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
    };
    setHistory((prev) => {
      const next = [full, ...prev].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return full;
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, addEntry, clearHistory };
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
