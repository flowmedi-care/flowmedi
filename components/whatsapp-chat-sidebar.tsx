"use client";

import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MessageSquare, Plus, Send, Info, Trash2, Check, User, ArrowLeft, Bot, Headphones, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppContactSidebar, type Patient } from "./whatsapp-contact-sidebar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SegmentedTabs } from "@/components/dashboard-ui/layout/segmented-tabs";
import { Badge } from "@/components/ui/badge";
import {
  WHATSAPP_HANDLER_FILTER_STORAGE_KEY,
  isValidHandlerFilter,
  VIRTUAL_ASSISTANT_ASSIGNEE_ID,
  type HandlerFilter,
  type ConversationHandler,
} from "@/lib/whatsapp-ai-state";
import { extractFirstName } from "@/lib/whatsapp-sender-display";
import { encodeMessageCursor } from "@/lib/whatsapp/message-cursor";
import { Skeleton } from "@/components/ui/skeleton";
import { TableRowsSkeleton } from "@/components/dashboard-ui/loading/table-page-skeleton";
import { CasePanel } from "@/components/ops/case-panel";
import type { OperationsSnapshot } from "@/lib/ops";
import { toast } from "@/components/ui/toast";

type OpsQueueFilter = "needs_decision" | "ai" | "patient_waiting" | "system" | "all";

/** Máquina de estados do painel de mensagens — skeleton só em Opening. */
type ChatState = "idle" | "opening" | "ready" | "syncing" | "sending";

type ScrollIntent = "initial" | "prepend" | "append";

const NEAR_BOTTOM_PX = 80;
const MESSAGES_PAGE_LIMIT = 50;

type Conversation = {
  id: string;
  phone_number: string;
  contact_name: string | null;
  status: "open" | "closed" | "completed";
  last_inbound_message_at: string | null;
  created_at: string;
  assigned_secretary_id: string | null;
  assigned_secretary: { id: string; full_name: string | null } | null;
  assigned_at: string | null;
  eligible_secretaries?: Array<{ id: string; full_name: string | null }>;
  ai_enabled: boolean | null;
  ai_handoff_at: string | null;
  ai_user_opt_out: boolean | null;
  handler: ConversationHandler;
  assistant_name?: string;
  ops?: OperationsSnapshot;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  media_url: string | null;
  message_type: string;
  sent_at: string;
  sender_type?: string | null;
  sender_name?: string | null;
  sender_user_id?: string | null;
  ai_processed_at?: string | null;
};

type MessagesPageResponse = {
  messages: Message[];
  hasMoreOlder: boolean;
  oldestCursor: string | null;
  newestCursor: string | null;
};

function mergeUniqueById(existing: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return existing;
  const byId = new Map<string, Message>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => {
    const ta = new Date(a.sent_at).getTime();
    const tb = new Date(b.sent_at).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

/** Após sync com msgs reais, remove bolhas otimistas temp-*. */
function mergeDroppingTemps(existing: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return existing;
  const withoutTemps = existing.filter((m) => !m.id.startsWith("temp-"));
  return mergeUniqueById(withoutTemps, incoming);
}

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
}

function mapRealtimePayloadToMessage(row: Record<string, unknown>): Message | null {
  const id = typeof row.id === "string" ? row.id : null;
  const sentAt = typeof row.sent_at === "string" ? row.sent_at : null;
  const direction = row.direction === "inbound" || row.direction === "outbound" ? row.direction : null;
  if (!id || !sentAt || !direction) return null;
  return {
    id,
    direction,
    body: typeof row.content === "string" ? row.content : row.content == null ? null : String(row.content),
    media_url: typeof row.media_url === "string" ? row.media_url : null,
    message_type: typeof row.message_type === "string" ? row.message_type : "text",
    sent_at: sentAt,
    sender_type: typeof row.sender_type === "string" ? row.sender_type : null,
    sender_name: typeof row.sender_name === "string" ? row.sender_name : null,
    sender_user_id: typeof row.sender_user_id === "string" ? row.sender_user_id : null,
    ai_processed_at: typeof row.ai_processed_at === "string" ? row.ai_processed_at : null,
  };
}

function formatLastPatientLabel(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Última do paciente: agora";
    if (diffMin < 60) return `Última do paciente: há ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Última do paciente: há ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return "Última do paciente: ontem";
    if (diffD < 7) return `Última do paciente: há ${diffD} dias`;
    return `Última do paciente: ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
  } catch {
    return null;
  }
}

type WhatsAppUsageLimit = {
  limit: number | null;
  used: number;
  remaining: number | null;
  blocked: boolean;
};

type ContactOption = {
  id: string;
  full_name: string | null;
  phone: string;
};

interface WhatsAppChatSidebarProps {
  fullWidth?: boolean;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDateLabel(iso: string): string {
  try {
    const messageDate = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Resetar horas para comparar apenas datas
    const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (messageDateOnly.getTime() === todayOnly.getTime()) {
      return "Hoje";
    } else if (messageDateOnly.getTime() === yesterdayOnly.getTime()) {
      return "Ontem";
    } else {
      // Formato: "20 de fevereiro de 2026" ou "20 de fev de 2026" se o ano for o atual
      const currentYear = today.getFullYear();
      const messageYear = messageDate.getFullYear();
      if (messageYear === currentYear) {
        return messageDate.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
      } else {
        return messageDate.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
      }
    }
  } catch {
    return "";
  }
}

function getDateKey(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  } catch {
    return "";
  }
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  if (digits.length >= 10) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  return phone;
}

function getHandlerSubtitle(conv: Conversation): string {
  if (conv.ai_user_opt_out) return "IA desativada pelo paciente";
  if (conv.handler === "ai") {
    return `${conv.assistant_name ?? "Assistente"} · Assistente virtual`;
  }
  const secretaryName = conv.assigned_secretary?.full_name;
  if (secretaryName) {
    return `${extractFirstName(secretaryName)} · Atendimento humano`;
  }
  return "Aguardando atendente";
}

function getOutboundSenderLabel(message: Message, assistantName: string): string | null {
  if (message.direction !== "outbound") return null;
  if (message.sender_name) return message.sender_name;
  if (message.ai_processed_at) return assistantName;
  if (message.sender_type === "system") return "Sistema";
  return "Equipe";
}

export function WhatsAppChatSidebar({ fullWidth }: WhatsAppChatSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [newestCursor, setNewestCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [loading, setLoading] = useState(true);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newContactQuery, setNewContactQuery] = useState("");
  const [newContactResults, setNewContactResults] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [loadingContactOptions, setLoadingContactOptions] = useState(false);
  const [newText, setNewText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [contactSidebarOpen, setContactSidebarOpen] = useState(false);
  const [patientByPhone, setPatientByPhone] = useState<Record<string, Patient>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [conversationStatusFilter, setConversationStatusFilter] = useState<"open" | "closed" | "completed" | null>("open");
  const [handlerFilter, setHandlerFilter] = useState<HandlerFilter>(() => {
    if (typeof window === "undefined") return "all";
    const stored = localStorage.getItem(WHATSAPP_HANDLER_FILTER_STORAGE_KEY);
    return isValidHandlerFilter(stored) ? stored : "all";
  });
  const [opsQueue, setOpsQueue] = useState<OpsQueueFilter>("needs_decision");
  const [claiming, setClaiming] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [casePanelOpen, setCasePanelOpen] = useState(false);
  const [completingConversationId, setCompletingConversationId] = useState<string | null>(null);
  const [secretaries, setSecretaries] = useState<{ id: string; full_name: string }[]>([]);
  const [usageLimit, setUsageLimit] = useState<WhatsAppUsageLimit | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const supabaseRef = useRef(createSupabaseBrowserClient());
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const scrollIntentRef = useRef<ScrollIntent | null>(null);
  const prependAnchorRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  const nearBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const chatStateRef = useRef<ChatState>("idle");
  const oldestCursorRef = useRef<string | null>(null);
  const newestCursorRef = useRef<string | null>(null);
  const hasMoreOlderRef = useRef(false);
  const fetchNewMessagesRef = useRef<() => Promise<void>>(async () => {});
  const patientCacheRef = useRef<Record<string, Patient | null>>({});
  const loadConversationsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  selectedIdRef.current = selectedId;

  const setChatStateSync = useCallback((next: ChatState | ((prev: ChatState) => ChatState)) => {
    setChatState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      chatStateRef.current = resolved;
      return resolved;
    });
  }, []);

  useEffect(() => {
    oldestCursorRef.current = oldestCursor;
  }, [oldestCursor]);
  useEffect(() => {
    newestCursorRef.current = newestCursor;
  }, [newestCursor]);
  useEffect(() => {
    hasMoreOlderRef.current = hasMoreOlder;
  }, [hasMoreOlder]);

  /** Única fonte da verdade do scroll — ninguém mais mexe em scrollTop/scrollIntoView. */
  useLayoutEffect(() => {
    const el = messagesScrollRef.current;
    const intent = scrollIntentRef.current;
    if (!el || !intent) return;
    scrollIntentRef.current = null;

    if (intent === "initial" || intent === "append") {
      el.scrollTop = el.scrollHeight;
      nearBottomRef.current = true;
      return;
    }

    if (intent === "prepend" && prependAnchorRef.current) {
      const { prevHeight, prevTop } = prependAnchorRef.current;
      el.scrollTop = el.scrollHeight - prevHeight + prevTop;
      prependAnchorRef.current = null;
      nearBottomRef.current = isNearBottom(el);
    }
  }, [messages]);

  const fetchPatientByPhone = useCallback(async (phone: string): Promise<Patient | null> => {
    try {
      const res = await fetch(`/api/patients/by-phone?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.patient ?? null;
    } catch {
      return null;
    }
  }, []);

  const loadUnreadCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCounts(data.byConversation || {});
        // Disparar evento customizado para atualizar sidebar de navegação
        window.dispatchEvent(new CustomEvent("whatsapp-unread-update", { detail: data.total }));
      }
    } catch {
      // Ignorar erro
    }
  }, []);

  const loadUsageLimit = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/usage-limit");
      if (!res.ok) return;
      const data = await res.json();
      setUsageLimit({
        limit: typeof data.limit === "number" ? data.limit : null,
        used: typeof data.used === "number" ? data.used : 0,
        remaining: typeof data.remaining === "number" ? data.remaining : null,
        blocked: Boolean(data.blocked),
      });
    } catch {
      // Ignorar erro
    }
  }, []);

  const handleDeleteConversation = async (conversationId: string) => {
    setDeletingConversationId(conversationId);
    try {
      const res = await fetch(`/api/whatsapp/delete-conversation?conversationId=${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelectedId(null);
        setMessages([]);
        await loadConversations(false); // Não mostrar loading ao enviar
        await loadUnreadCounts();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao excluir conversa");
      }
    } catch (error) {
      alert("Erro ao excluir conversa");
      console.error(error);
    } finally {
      setDeletingConversationId(null);
    }
  };

  const loadConversations = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (conversationStatusFilter) {
        params.set("status", conversationStatusFilter);
      }
      if (handlerFilter !== "all") {
        params.set("handler", handlerFilter);
      }
      const query = params.toString();
      const url = query
        ? `/api/whatsapp/conversations?${query}`
        : "/api/whatsapp/conversations";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        const convos = data as Conversation[];
        const map: Record<string, Patient> = {};
        const phonesToFetch = convos
          .map((c) => c.phone_number)
          .filter((phone) => patientCacheRef.current[phone] === undefined);

        await Promise.all(
          phonesToFetch.map(async (phone) => {
            const patient = await fetchPatientByPhone(phone);
            patientCacheRef.current[phone] = patient;
            if (patient) map[phone] = patient;
          })
        );

        for (const c of convos) {
          const cached = patientCacheRef.current[c.phone_number];
          if (cached) map[c.phone_number] = cached;
        }

        setPatientByPhone((prev) => ({ ...prev, ...map }));
      } else {
        setConversations([]);
      }
    } catch {
      setConversations([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [conversationStatusFilter, handlerFilter, fetchPatientByPhone]);

  const scheduleLoadConversations = useCallback(
    (showLoading = false) => {
      if (loadConversationsTimerRef.current) {
        clearTimeout(loadConversationsTimerRef.current);
      }
      loadConversationsTimerRef.current = setTimeout(() => {
        void loadConversations(showLoading);
      }, 400);
    },
    [loadConversations]
  );

  const handleCompleteConversation = async (conversationId: string) => {
    setCompletingConversationId(conversationId);
    try {
      const res = await fetch("/api/whatsapp/complete-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (res.ok) {
        // Atualizar status localmente sem recarregar tudo
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, status: "completed" as const } : c))
        );
        if (selectedId === conversationId) {
          setSelectedId(null);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao concluir conversa");
      }
    } catch (error) {
      alert("Erro ao concluir conversa");
      console.error(error);
    } finally {
      setCompletingConversationId(null);
    }
  };

  // Verificar e fechar conversas expiradas periodicamente (sem recarregar lista imediatamente)
  useEffect(() => {
    const checkExpired = async () => {
      try {
        await fetch("/api/whatsapp/close-expired", { method: "POST" });
        // Só recarregar se estiver na aba de "open" (pode ter fechado algumas)
        if (conversationStatusFilter === "open") {
          await loadConversations(false); // Não mostrar loading ao verificar expiradas
        }
      } catch {
        // Ignorar erro
      }
    };
    // Verificar apenas a cada 5 minutos (não precisa ser tão frequente)
    const interval = setInterval(checkExpired, 5 * 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationStatusFilter]);

  const resetMessageState = useCallback(() => {
    setMessages([]);
    setHasMoreOlder(false);
    setOldestCursor(null);
    setNewestCursor(null);
    oldestCursorRef.current = null;
    newestCursorRef.current = null;
    hasMoreOlderRef.current = false;
    nearBottomRef.current = true;
    scrollIntentRef.current = null;
    prependAnchorRef.current = null;
  }, []);

  const fetchInitialMessages = useCallback(async () => {
    const cid = selectedIdRef.current;
    if (!cid) return;
    setChatStateSync("opening");
    const url = `/api/whatsapp/messages?conversationId=${encodeURIComponent(cid)}&limit=${MESSAGES_PAGE_LIMIT}`;
    try {
      const res = await fetch(url);
      if (selectedIdRef.current !== cid) return;
      if (!res.ok) {
        resetMessageState();
        setChatStateSync("ready");
        return;
      }
      const data = (await res.json()) as MessagesPageResponse;
      if (selectedIdRef.current !== cid) return;
      if (!data || !Array.isArray(data.messages)) {
        resetMessageState();
        setChatStateSync("ready");
        return;
      }
      scrollIntentRef.current = "initial";
      setMessages(data.messages);
      setHasMoreOlder(Boolean(data.hasMoreOlder));
      setOldestCursor(data.oldestCursor);
      setNewestCursor(data.newestCursor);
      setChatStateSync("ready");
    } catch {
      if (selectedIdRef.current !== cid) return;
      resetMessageState();
      setChatStateSync("ready");
    }
  }, [resetMessageState, setChatStateSync]);

  const fetchOlderMessages = useCallback(async () => {
    const cid = selectedIdRef.current;
    if (!cid) return;
    if (loadingOlderRef.current) return;
    if (!hasMoreOlderRef.current || !oldestCursorRef.current) return;

    const scrollEl = messagesScrollRef.current;
    if (scrollEl) {
      prependAnchorRef.current = {
        prevHeight: scrollEl.scrollHeight,
        prevTop: scrollEl.scrollTop,
      };
    }

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const url =
        `/api/whatsapp/messages?conversationId=${encodeURIComponent(cid)}` +
        `&limit=${MESSAGES_PAGE_LIMIT}&before=${encodeURIComponent(oldestCursorRef.current)}`;
      const res = await fetch(url);
      if (selectedIdRef.current !== cid) return;
      if (!res.ok) return;
      const data = (await res.json()) as MessagesPageResponse;
      if (selectedIdRef.current !== cid) return;
      if (!Array.isArray(data.messages) || data.messages.length === 0) {
        setHasMoreOlder(false);
        prependAnchorRef.current = null;
        return;
      }
      scrollIntentRef.current = "prepend";
      setMessages((prev) => mergeUniqueById(data.messages, prev));
      setHasMoreOlder(Boolean(data.hasMoreOlder));
      if (data.oldestCursor) setOldestCursor(data.oldestCursor);
    } catch {
      prependAnchorRef.current = null;
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, []);

  const fetchNewMessages = useCallback(async () => {
    const cid = selectedIdRef.current;
    if (!cid) return;
    if (chatStateRef.current === "opening" || chatStateRef.current === "idle") return;
    const after = newestCursorRef.current;
    // Sem cursor da conversa atual → no-op (nunca fallback para latest-50)
    if (!after) return;

    setChatStateSync((s) => (s === "ready" || s === "syncing" ? "syncing" : s));
    try {
      const url =
        `/api/whatsapp/messages?conversationId=${encodeURIComponent(cid)}` +
        `&limit=${MESSAGES_PAGE_LIMIT}&after=${encodeURIComponent(after)}`;
      const res = await fetch(url);
      if (selectedIdRef.current !== cid) return;
      if (!res.ok) return;
      const data = (await res.json()) as MessagesPageResponse;
      if (selectedIdRef.current !== cid) return;
      if (!Array.isArray(data.messages) || data.messages.length === 0) {
        setChatStateSync((s) => (s === "syncing" ? "ready" : s));
        return;
      }
      const stick = nearBottomRef.current;
      if (stick) scrollIntentRef.current = "append";
      setMessages((prev) => mergeDroppingTemps(prev, data.messages));
      if (data.newestCursor) setNewestCursor(data.newestCursor);
      setChatStateSync((s) => (s === "syncing" || s === "sending" ? "ready" : s));
    } catch {
      setChatStateSync((s) => (s === "syncing" ? "ready" : s));
    }
  }, [setChatStateSync]);

  /** Primeiro outbound sem cursor: merge latest page sem skeleton/replace. */
  const bootstrapAfterFirstSend = useCallback(async () => {
    const cid = selectedIdRef.current;
    if (!cid) return;
    try {
      const url = `/api/whatsapp/messages?conversationId=${encodeURIComponent(cid)}&limit=${MESSAGES_PAGE_LIMIT}`;
      const res = await fetch(url);
      if (selectedIdRef.current !== cid || !res.ok) return;
      const data = (await res.json()) as MessagesPageResponse;
      if (selectedIdRef.current !== cid || !Array.isArray(data.messages)) return;
      scrollIntentRef.current = "append";
      setMessages((prev) => mergeDroppingTemps(prev, data.messages));
      setHasMoreOlder(Boolean(data.hasMoreOlder));
      if (data.oldestCursor) setOldestCursor(data.oldestCursor);
      if (data.newestCursor) setNewestCursor(data.newestCursor);
    } catch {
      // ignore
    }
  }, []);

  fetchNewMessagesRef.current = fetchNewMessages;

  const applyRealtimeMessage = useCallback((row: Record<string, unknown>) => {
    if (chatStateRef.current === "opening" || chatStateRef.current === "idle") return;
    const msg = mapRealtimePayloadToMessage(row);
    if (!msg) {
      void fetchNewMessagesRef.current();
      return;
    }
    const stick = nearBottomRef.current;
    if (stick) scrollIntentRef.current = "append";
    setMessages((prev) => mergeDroppingTemps(prev, [msg]));
    setNewestCursor(encodeMessageCursor(msg.sent_at, msg.id));
    setChatStateSync((s) => (s === "syncing" || s === "sending" ? "ready" : s));
  }, [setChatStateSync]);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    nearBottomRef.current = isNearBottom(el);
    if (el.scrollTop < NEAR_BOTTOM_PX) {
      void fetchOlderMessages();
    }
  }, [fetchOlderMessages]);

  useEffect(() => {
    const syncMobile = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 640);
    };
    syncMobile();
    window.addEventListener("resize", syncMobile);
    return () => window.removeEventListener("resize", syncMobile);
  }, []);

  useEffect(() => {
    localStorage.setItem(WHATSAPP_HANDLER_FILTER_STORAGE_KEY, handlerFilter);
  }, [handlerFilter]);

  // Deep-link: /dashboard/whatsapp?c=<conversationId>|&phone=
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("c") || params.get("conversation");
    if (cid) setSelectedId(cid);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || selectedId) return;
    const params = new URLSearchParams(window.location.search);
    const phone = (params.get("phone") || "").replace(/\D/g, "");
    if (!phone || conversations.length === 0) return;
    const match = conversations.find((c) =>
      c.phone_number.replace(/\D/g, "").endsWith(phone.slice(-8))
    );
    if (match) setSelectedId(match.id);
  }, [conversations, selectedId]);

  useEffect(() => {
    loadConversations();
    loadUnreadCounts();
    loadUsageLimit();
  }, [loadConversations, loadUnreadCounts, loadUsageLimit]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadUsageLimit();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadUsageLimit]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel("whatsapp-chat-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const row = (payload.new ?? {}) as Record<string, unknown>;
          const conversationId = String(row.conversation_id ?? "");
          if (selectedIdRef.current && conversationId === selectedIdRef.current) {
            // XOR: payload completo → merge; senão after=
            if (mapRealtimePayloadToMessage(row)) {
              applyRealtimeMessage(row);
            } else {
              void fetchNewMessagesRef.current();
            }
          }
          scheduleLoadConversations(false);
          loadUnreadCounts();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        () => {
          scheduleLoadConversations(false);
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [scheduleLoadConversations, loadUnreadCounts, applyRealtimeMessage]);

  // Fallback de polling curto quando socket estiver indisponível
  useEffect(() => {
    if (realtimeConnected) return;
    const interval = setInterval(() => {
      scheduleLoadConversations(false);
      loadUnreadCounts();
      void fetchNewMessagesRef.current();
    }, 4000);
    return () => clearInterval(interval);
  }, [realtimeConnected, scheduleLoadConversations, loadUnreadCounts]);

  useEffect(() => {
    fetch("/api/whatsapp/secretaries")
      .then((r) => r.json())
      .then((data) => setSecretaries(Array.isArray(data) ? data : []))
      .catch(() => setSecretaries([]));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setChatStateSync("idle");
      resetMessageState();
      setReplyText("");
      return;
    }

    // Reset imediato antes do fetch — corta race de cursors A→B
    setChatStateSync("opening");
    resetMessageState();
    setReplyText("");

    fetch("/api/whatsapp/mark-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId }),
    }).then(() => {
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        delete updated[selectedId];
        const newTotal = Object.values(updated).reduce((sum, count) => sum + count, 0);
        window.dispatchEvent(new CustomEvent("whatsapp-unread-update", { detail: newTotal }));
        return updated;
      });
      loadUnreadCounts();
    });

    void fetchInitialMessages();
    const interval = setInterval(() => {
      void fetchNewMessagesRef.current();
      loadUnreadCounts();
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedId, loadUnreadCounts, fetchInitialMessages, resetMessageState, setChatStateSync]);

  const selectedConversation = conversations.find((c) => c.id === selectedId);
  const showListPane = !fullWidth || !isMobile || !selectedId;
  const showChatPane = !fullWidth || !isMobile || !!selectedId;

  const handleSendNew = async () => {
    const selectedContact = newContactResults.find((contact) => contact.id === selectedContactId) ?? null;
    const to = (selectedContact?.phone ?? "").replace(/\D/g, "");
    if (!to || !newText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text: newText.trim() }),
      });
      if (res.ok) {
        setNewChatOpen(false);
        setNewContactQuery("");
        setNewContactResults([]);
        setSelectedContactId("");
        setNewText("");
        loadConversations(false);
        loadUnreadCounts();
        loadUsageLimit();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao enviar mensagem");
      }
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!newChatOpen) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoadingContactOptions(true);
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(newContactQuery.trim())}`);
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const contacts = Array.isArray(data.contacts) ? (data.contacts as ContactOption[]) : [];
        setNewContactResults(contacts);
        setSelectedContactId((prev) =>
          prev && contacts.some((contact) => contact.id === prev) ? prev : ""
        );
      } catch {
        if (!cancelled) setNewContactResults([]);
      } finally {
        if (!cancelled) setLoadingContactOptions(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [newChatOpen, newContactQuery]);

  const handleSendInChat = async () => {
    if (!selectedConversation || !replyText.trim()) return;

    const text = replyText.trim();
    setReplyText("");
    setSendingReply(true);
    setChatStateSync("sending");
    const tempId = `temp-${Date.now()}`;
    scrollIntentRef.current = "append";
    nearBottomRef.current = true;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        direction: "outbound" as const,
        body: text,
        media_url: null,
        message_type: "text",
        sent_at: new Date().toISOString(),
      },
    ]);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selectedConversation.phone_number, text }),
      });
      if (res.ok) {
        // Mantém temp até o merge trazer a msg real (não remove antes)
        nearBottomRef.current = true;
        scrollIntentRef.current = "append";
        if (newestCursorRef.current) {
          await fetchNewMessagesRef.current();
        } else {
          await bootstrapAfterFirstSend();
        }
        setChatStateSync("ready");
        loadUnreadCounts();
        loadUsageLimit();
      } else {
        const data = await res.json();
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setChatStateSync("ready");
        if (data.status && data.status !== "open") {
          alert(data.error || "Não é possível enviar mensagem de texto livre nesta conversa.");
          await loadConversations(false);
        }
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setChatStateSync("ready");
    } finally {
      setSendingReply(false);
    }
  };

  const matchesOpsQueue = (c: Conversation, q: OpsQueueFilter): boolean => {
    const owner =
      c.ops?.owner ?? (c.handler === "ai" && !c.ai_user_opt_out ? "ai" : "human");
    if (q === "all") return true;
    if (q === "ai") return owner === "ai";
    if (q === "patient_waiting") return owner === "patient_waiting";
    if (q === "system") return owner === "system";
    // needs_decision: humano, handoff, SLA estourado ou pendingDecision humana
    if (owner === "human") return true;
    if (c.ops?.sla.breached) return true;
    if (c.ops?.pendingDecision?.owner === "human") return true;
    return false;
  };

  const visibleConversations = conversations.filter((c) =>
    matchesOpsQueue(c, opsQueue)
  );

  const selectedOps = selectedConversation?.ops ?? null;

  async function handleClaim() {
    if (!selectedConversation) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/whatsapp/assign-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          claim: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Não foi possível assumir", "error");
        return;
      }
      toast("Você está conduzindo este atendimento", "success");
      await loadConversations(false);
    } finally {
      setClaiming(false);
    }
  }

  async function handleReactivateAi(brief: string) {
    if (!selectedConversation) return;
    setReactivating(true);
    try {
      const res = await fetch("/api/whatsapp/assign-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          secretaryId: VIRTUAL_ASSISTANT_ASSIGNEE_ID,
          brief,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Não foi possível devolver à IA", "error");
        return;
      }
      toast("Atendimento devolvido à IA", "success");
      await loadConversations(false);
    } finally {
      setReactivating(false);
    }
  }

  async function handleSaveNotes(notes: string) {
    if (!selectedConversation) return;
    const res = await fetch("/api/whatsapp/ops/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: selectedConversation.id,
        notes,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast(data.error || "Erro ao salvar notas", "error");
      return;
    }
    toast("Notas salvas", "success");
    await loadConversations(false);
  }

  return (
    <>
      <div
        className={cn(
          "flex h-full min-h-0 w-full",
          fullWidth ? "sm:flex-row sm:h-full" : "flex-row"
        )}
      >
        <div
          className={cn(
            "flex flex-col border-r border-border bg-card min-w-0 shrink-0",
            fullWidth ? "w-full sm:h-auto sm:w-80 sm:min-w-[280px] sm:min-h-0" : "w-80",
            !showListPane && "hidden sm:flex"
          )}
        >
          <div className="px-3 py-2 border-b border-border space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm truncate">Conversas</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNewChatOpen(true)}
                className="shrink-0 h-9 w-9"
                title="Nova conversa"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <SegmentedTabs
              variant="pill"
              className="gap-1 flex-wrap"
              value={opsQueue}
              onChange={(id) => {
                setOpsQueue(id as OpsQueueFilter);
                // API: busca ampla; facet é client-side via OperationsSnapshot
                setHandlerFilter("all");
              }}
              tabs={[
                { id: "needs_decision", label: "Pendências", icon: Headphones },
                { id: "ai", label: "Com a IA", icon: Bot },
                { id: "patient_waiting", label: "Aguardando paciente" },
                { id: "system", label: "Sistema" },
                { id: "all", label: "Todos" },
              ]}
            />
          </div>
          {usageLimit && usageLimit.limit !== null && (
            <div
              className={cn(
                "mx-2 mt-2 mb-1 rounded-md px-3 py-2 text-xs border",
                usageLimit.blocked
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
              )}
            >
              {usageLimit.blocked
                ? `Limite mensal atingido (${usageLimit.used}/${usageLimit.limit}).`
                : `Limite mensal pós-24h: ${usageLimit.used}/${usageLimit.limit} (${usageLimit.remaining} restante${usageLimit.remaining === 1 ? "" : "s"}).`}
            </div>
          )}
          {/* Abas: janela Meta 24h vs ticket concluído */}
          <div className="flex flex-col border-b border-border">
            <p className="px-3 pt-2 text-[10px] text-muted-foreground leading-snug">
              Janela de 24h da Meta: aberta pelo paciente; resposta da clínica não reinicia.
            </p>
            <div className="flex gap-0 px-2">
            <button
              type="button"
              onClick={() => setConversationStatusFilter("open")}
              className={cn(
                "flex-1 px-2 py-2 text-[11px] font-medium border-b-2 transition-colors",
                conversationStatusFilter === "open"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Na janela (24h)
            </button>
            <button
              type="button"
              onClick={() => setConversationStatusFilter("closed")}
              className={cn(
                "flex-1 px-2 py-2 text-[11px] font-medium border-b-2 transition-colors",
                conversationStatusFilter === "closed"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Fora da janela (24h)
            </button>
            <button
              type="button"
              onClick={() => setConversationStatusFilter("completed")}
              className={cn(
                "flex-1 px-2 py-2 text-[11px] font-medium border-b-2 transition-colors",
                conversationStatusFilter === "completed"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Concluídas
            </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-2">
                <TableRowsSkeleton count={6} />
              </div>
            ) : visibleConversations.length === 0 ? (
              <p className="p-4 text-muted-foreground text-sm">
                {conversations.length === 0
                  ? "Nenhuma conversa ainda. Use o botão acima para iniciar."
                  : "Nenhum atendimento nesta fila."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visibleConversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors",
                        selectedId === c.id && "bg-muted/60"
                      )}
                    >
                      <div className={cn(
                        "flex h-10 w-10 rounded-full items-center justify-center shrink-0",
                        patientByPhone[c.phone_number]
                          ? "bg-primary/10"
                          : "bg-yellow-100 dark:bg-yellow-900/20"
                      )}>
                        <User className={cn(
                          "h-5 w-5",
                          patientByPhone[c.phone_number]
                            ? "text-primary"
                            : "text-yellow-600 dark:text-yellow-400"
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="block font-medium truncate flex-1">
                            {patientByPhone[c.phone_number]?.full_name ?? 
                             c.contact_name ?? 
                             formatPhone(c.phone_number)}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 text-[10px] px-1.5 py-0",
                              c.ops?.sla.breached && "border-destructive text-destructive"
                            )}
                          >
                            {c.ops?.ownerLabel ??
                              (c.handler === "ai" ? "IA" : "Humano")}
                          </Badge>
                          {unreadCounts[c.id] > 0 && (
                            <span className="flex-shrink-0 h-5 min-w-[20px] px-1.5 rounded-full bg-[#25D366] text-white text-xs font-semibold flex items-center justify-center">
                              {unreadCounts[c.id] > 99 ? "99+" : unreadCounts[c.id]}
                            </span>
                          )}
                        </div>
                        {(patientByPhone[c.phone_number] || c.contact_name) && (
                          <span className="block text-xs text-muted-foreground truncate">
                            {formatPhone(c.phone_number)}
                          </span>
                        )}
                        {(() => {
                          const lastPatient = formatLastPatientLabel(c.last_inbound_message_at);
                          return lastPatient ? (
                            <span className="block text-[10px] text-muted-foreground/80 truncate mt-0.5">
                              {lastPatient}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex-1 flex flex-col min-h-0 min-w-0 bg-background overflow-hidden",
            !showChatPane && "hidden sm:flex"
          )}
        >
          {selectedId ? (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-card">
                {fullWidth && isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9"
                    onClick={() => setSelectedId(null)}
                    title="Voltar para conversas"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setContactSidebarOpen(true)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 rounded-full items-center justify-center shrink-0",
                      selectedConversation && patientByPhone[selectedConversation.phone_number]
                        ? "bg-primary/10"
                        : "bg-yellow-100 dark:bg-yellow-900/20"
                    )}
                  >
                    <User
                      className={cn(
                        "h-5 w-5",
                        selectedConversation && patientByPhone[selectedConversation.phone_number]
                          ? "text-primary"
                          : "text-yellow-600 dark:text-yellow-400"
                      )}
                    />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold truncate min-w-0">
                      {selectedConversation
                        ? patientByPhone[selectedConversation.phone_number]?.full_name ??
                          selectedConversation.contact_name ??
                          formatPhone(selectedConversation.phone_number)
                        : selectedId}
                    </span>
                    {selectedConversation && (
                      <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        {selectedOps?.owner === "ai" ||
                        (selectedConversation.handler === "ai" &&
                          !selectedConversation.ai_user_opt_out) ? (
                          <Bot className="h-3 w-3 shrink-0" />
                        ) : (
                          <Headphones className="h-3 w-3 shrink-0" />
                        )}
                        {selectedOps
                          ? `Responsável: ${selectedOps.ownerLabel}`
                          : getHandlerSubtitle(selectedConversation)}
                        {selectedOps?.pendingDecision
                          ? ` · ${selectedOps.pendingDecision.label}`
                          : ""}
                      </span>
                    )}
                  </div>
                </button>
                {selectedOps && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9 lg:hidden"
                    onClick={() => setCasePanelOpen(true)}
                    title="Painel do caso"
                  >
                    <PanelRight className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => setContactSidebarOpen(true)}
                  title="Informações do contato"
                >
                  <Info className="h-5 w-5" />
                </Button>
                {selectedConversation && selectedConversation.status !== "completed" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9 text-green-600 hover:text-green-700"
                    onClick={() => handleCompleteConversation(selectedConversation.id)}
                    disabled={completingConversationId === selectedId}
                    title="Concluir conversa"
                  >
                    <Check className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9 text-destructive hover:text-destructive"
                  onClick={() => selectedConversation && setConversationToDelete(selectedConversation.id)}
                  disabled={deletingConversationId === selectedId}
                  title="Excluir conversa"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
              <div
                ref={messagesScrollRef}
                onScroll={handleMessagesScroll}
                className="flex-1 overflow-y-auto p-3 sm:p-4 whatsapp-chat-wallpaper min-h-0"
              >
                {chatState === "opening" ? (
                  <div className="space-y-4 py-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}
                      >
                        <Skeleton
                          className={cn(
                            "h-12 rounded-2xl",
                            i % 2 === 0 ? "w-2/3 max-w-sm" : "w-1/2 max-w-xs"
                          )}
                        />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda</p>
                    <p className="text-muted-foreground/70 text-xs mt-1">Envie ou receba uma mensagem para começar</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(loadingOlder || hasMoreOlder) && (
                      <div className="flex justify-center py-2">
                        {loadingOlder ? (
                          <span className="text-xs text-muted-foreground">Carregando…</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/70">Role para cima para ver mais</span>
                        )}
                      </div>
                    )}
                    {(() => {
                      // Agrupar mensagens por data
                      const groupedMessages: Array<{ dateKey: string; dateLabel: string; messages: Message[] }> = [];
                      let currentGroup: { dateKey: string; dateLabel: string; messages: Message[] } | null = null;

                      messages.forEach((m) => {
                        const dateKey = getDateKey(m.sent_at);
                        if (!currentGroup || currentGroup.dateKey !== dateKey) {
                          if (currentGroup) {
                            groupedMessages.push(currentGroup);
                          }
                          currentGroup = {
                            dateKey,
                            dateLabel: formatDateLabel(m.sent_at),
                            messages: [m],
                          };
                        } else {
                          currentGroup.messages.push(m);
                        }
                      });
                      if (currentGroup) {
                        groupedMessages.push(currentGroup);
                      }

                      return groupedMessages.map((group) => (
                        <React.Fragment key={group.dateKey}>
                          {/* Separador de data */}
                          <div className="flex items-center justify-center my-4">
                            <div className="px-3 py-1 bg-white/90 dark:bg-[#182229] rounded-lg shadow-sm">
                              <span className="text-xs text-muted-foreground font-medium">{group.dateLabel}</span>
                            </div>
                          </div>
                          {/* Mensagens do grupo */}
                          {group.messages.map((m) => {
                            const assistantName =
                              selectedConversation?.assistant_name ?? "Assistente";
                            const senderLabel = getOutboundSenderLabel(m, assistantName);

                            return (
                            <div
                              key={m.id}
                              className={cn(
                                "flex flex-col max-w-[75%]",
                                m.direction === "outbound" ? "ml-auto items-end" : "items-start"
                              )}
                            >
                              {senderLabel && (
                                <span className="text-[11px] text-muted-foreground mb-0.5 px-1">
                                  {senderLabel}
                                </span>
                              )}
                              <div
                                className={cn(
                                  "rounded-lg px-3 py-2 text-[14.5px] leading-snug shadow-sm max-w-full break-words overflow-hidden",
                                  m.direction === "outbound"
                                    ? "bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef] rounded-tr-none"
                                    : "bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef] rounded-tl-none"
                                )}
                              >
                                {m.media_url && m.message_type === "image" ? (
                                  <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="block">
                                    <img
                                      src={m.media_url}
                                      alt="Imagem recebida"
                                      className="max-w-full max-h-64 rounded-lg object-contain"
                                    />
                                  </a>
                                ) : m.media_url && m.message_type === "audio" ? (
                                  <audio controls className="max-w-full" src={m.media_url}>
                                    Áudio não suportado.
                                  </audio>
                                ) : m.media_url && m.message_type === "video" ? (
                                  <video controls className="max-w-full max-h-64 rounded-lg" src={m.media_url}>
                                    Vídeo não suportado.
                                  </video>
                                ) : m.media_url && m.message_type === "document" ? (
                                  <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                    Ver documento
                                  </a>
                                ) : (
                                  <span className="whitespace-pre-wrap">{m.body ?? "(mídia)"}</span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                                {formatTime(m.sent_at)}
                              </span>
                            </div>
                            );
                          })}
                        </React.Fragment>
                      ));
                    })()}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-border flex flex-col gap-2 bg-card">
                {selectedConversation && selectedConversation.status !== "open" && (
                  <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-3 py-2 rounded-md">
                    {selectedConversation.status === "closed"
                      ? "Fora da janela (24h) — envie template aprovado. A janela só reabre com mensagem do paciente."
                      : "Conversa concluída. A mensagem será enviada via template aprovado."}
                  </div>
                )}
                {selectedOps && !selectedOps.canCompose && (
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-2">
                    <p className="text-xs text-foreground">
                      Este atendimento está sendo conduzido por{" "}
                      <span className="font-semibold">{selectedOps.conductorLabel}</span>.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={handleClaim} disabled={claiming}>
                        Assumir atendimento
                      </Button>
                      <Button size="sm" variant="ghost" disabled title="Em breve">
                        Enviar observação para {selectedOps.conductorLabel}
                      </Button>
                    </div>
                  </div>
                )}
                {selectedOps?.canCompose && (
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" disabled title="Em breve">
                      Enviar observação (em breve)
                    </Button>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (selectedOps && !selectedOps.canCompose) return;
                        handleSendInChat();
                      }
                    }}
                    placeholder={
                      selectedOps && !selectedOps.canCompose
                        ? "Assuma o atendimento para responder…"
                        : "Digite uma mensagem..."
                    }
                    className="min-h-11 flex-1"
                    disabled={Boolean(selectedOps && !selectedOps.canCompose)}
                  />
                  <Button
                    onClick={handleSendInChat}
                    disabled={
                      sendingReply ||
                      !replyText.trim() ||
                      Boolean(selectedOps && !selectedOps.canCompose)
                    }
                    size="icon"
                    className="rounded-lg h-11 w-11 shrink-0 bg-[#00a884] hover:bg-[#008f72] text-white disabled:opacity-50"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] dark:bg-[#111b21]">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white dark:bg-[#202c33] shadow-sm mb-4">
                  <MessageSquare className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="font-medium">Selecione uma conversa</p>
                <p className="text-muted-foreground text-sm mt-1">ou use o botão + para iniciar uma nova</p>
              </div>
            </div>
          )}
        </div>

        {selectedOps && showChatPane && (
          <div className="hidden lg:flex h-full min-h-0 shrink-0">
            <CasePanel
              snapshot={selectedOps}
              onClaim={handleClaim}
              onReactivateAi={handleReactivateAi}
              onSaveNotes={handleSaveNotes}
              claiming={claiming}
              reactivating={reactivating}
            />
          </div>
        )}
      </div>

      {selectedOps && (
        <Dialog open={casePanelOpen} onOpenChange={setCasePanelOpen}>
          <DialogContent
            title="Caso"
            onClose={() => setCasePanelOpen(false)}
            className="max-w-md p-0 sm:max-w-md"
          >
            <div className="-m-6 h-[80vh]">
              <CasePanel
                snapshot={selectedOps}
                onClaim={handleClaim}
                onReactivateAi={handleReactivateAi}
                onSaveNotes={handleSaveNotes}
                claiming={claiming}
                reactivating={reactivating}
                className="max-w-none min-w-0 border-0 h-full"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedConversation && (
        <WhatsAppContactSidebar
          open={contactSidebarOpen}
          onClose={() => setContactSidebarOpen(false)}
          phoneNumber={selectedConversation.phone_number}
          contactName={selectedConversation.contact_name}
          patient={patientByPhone[selectedConversation.phone_number] ?? null}
          onPatientLinked={(patient) => {
            setPatientByPhone((prev) => ({ ...prev, [selectedConversation.phone_number]: patient }));
          }}
          conversationId={selectedConversation.id}
          assignedSecretary={selectedConversation.assigned_secretary}
          eligibleSecretaries={selectedConversation.eligible_secretaries ?? []}
          conversationHandler={selectedConversation.handler}
          secretaries={secretaries}
          onAssignConversation={async (secretaryId) => {
            const res = await fetch("/api/whatsapp/assign-conversation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversationId: selectedConversation.id,
                secretaryId,
              }),
            });
            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error ?? "Erro ao encaminhar");
            }
            const data = (await res.json()) as { handler?: ConversationHandler };
            const isVirtualAssistant = secretaryId === VIRTUAL_ASSISTANT_ASSIGNEE_ID;
            await loadConversations(false);
            setConversations((prev) =>
              prev.map((c) =>
                c.id === selectedConversation.id
                  ? isVirtualAssistant || data.handler === "ai"
                    ? {
                        ...c,
                        assigned_secretary_id: null,
                        assigned_secretary: null,
                        assigned_at: null,
                        ai_handoff_at: null,
                        ai_enabled: true,
                        handler: "ai" as const,
                        eligible_secretaries: [],
                      }
                    : {
                        ...c,
                        assigned_secretary_id: secretaryId,
                        assigned_secretary: secretaries.find((s) => s.id === secretaryId)
                          ? {
                              id: secretaryId,
                              full_name: secretaries.find((s) => s.id === secretaryId)!.full_name,
                            }
                          : null,
                        assigned_at: new Date().toISOString(),
                        handler: "human" as const,
                        eligible_secretaries: [],
                      }
                  : c
              )
            );
          }}
        />
      )}

      <ConfirmDialog
        open={!!conversationToDelete}
        title="Excluir conversa"
        message="Tem certeza que deseja excluir esta conversa? Todas as mensagens, imagens e documentos serão permanentemente removidos."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={deletingConversationId !== null}
        onConfirm={() => {
          if (conversationToDelete) {
            handleDeleteConversation(conversationToDelete);
            setConversationToDelete(null);
          }
        }}
        onCancel={() => setConversationToDelete(null)}
      />

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent
          title="Nova conversa"
          onClose={() => {
            setNewChatOpen(false);
            setNewContactQuery("");
            setNewContactResults([]);
            setSelectedContactId("");
            setNewText("");
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Contato</label>
              <Input
                value={newContactQuery}
                onChange={(e) => setNewContactQuery(e.target.value)}
                placeholder="Buscar paciente por nome..."
              />
              <div className="mt-2 max-h-40 overflow-auto rounded-md border border-border">
                {loadingContactOptions ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Buscando contatos...</p>
                ) : newContactResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum contato encontrado.</p>
                ) : (
                  <ul>
                    {newContactResults.map((contact) => (
                      <li key={contact.id}>
                        <button
                          type="button"
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm hover:bg-muted",
                            selectedContactId === contact.id && "bg-muted"
                          )}
                          onClick={() => setSelectedContactId(contact.id)}
                        >
                          <span className="font-medium block truncate">
                            {contact.full_name || "Sem nome"}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatPhone(contact.phone)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Mensagem</label>
              <Input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Digite a mensagem..."
              />
            </div>
            <Button
              onClick={handleSendNew}
              disabled={sending || !selectedContactId || !newText.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
