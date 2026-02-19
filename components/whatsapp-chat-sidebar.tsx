"use client";

import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MessageSquare, Plus, Send, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  phone_number: string;
  created_at: string;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  media_url: string | null;
  message_type: string;
  sent_at: string;
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

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  if (digits.length >= 10) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  return phone;
}

export function WhatsAppChatSidebar({ fullWidth }: WhatsAppChatSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newTo, setNewTo] = useState("");
  const [newText, setNewText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      } else {
        setConversations([]);
      }
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = (showLoading = false) => {
    if (!selectedId) return;
    if (showLoading) setLoadingMessages(true);
    fetch(`/api/whatsapp/messages?conversationId=${encodeURIComponent(selectedId)}`)
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setReplyText("");
      return;
    }
    loadMessages(true); // loading só na primeira vez
    const interval = setInterval(() => loadMessages(false), 5000); // 5s, sem piscar
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  const handleSendNew = async () => {
    const to = newTo.replace(/\D/g, "");
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
        setNewTo("");
        setNewText("");
        loadConversations();
      }
    } finally {
      setSending(false);
    }
  };

  const handleSendInChat = async () => {
    if (!selectedConversation || !replyText.trim()) return;
    const text = replyText.trim();
    setReplyText("");
    setSendingReply(true);
    const tempId = `temp-${Date.now()}`;
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
        loadMessages();
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex h-full min-h-0 w-full",
          fullWidth ? "flex-col sm:flex-row sm:h-full" : "flex-row"
        )}
      >
        <div
          className={cn(
            "flex flex-col border-r border-border bg-muted/30 min-w-0 shrink-0",
            fullWidth ? "w-full sm:w-80 sm:min-w-[280px] sm:min-h-0" : "w-80"
          )}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm truncate">Conversas</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNewChatOpen(true)}
              className="shrink-0 h-9 w-9"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-muted-foreground text-sm">Carregando...</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-muted-foreground text-sm">
                Nenhuma conversa ainda. Use o botão acima para iniciar.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors",
                        selectedId === c.id && "bg-muted"
                      )}
                    >
                      <div className="flex h-10 w-10 rounded-full bg-muted items-center justify-center shrink-0">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block font-medium truncate">{formatPhone(c.phone_number)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background overflow-hidden">
          {selectedId ? (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-card">
                <div className="flex h-10 w-10 rounded-full bg-muted items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="font-semibold truncate">
                  {selectedConversation ? formatPhone(selectedConversation.phone_number) : selectedId}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-muted/10 min-h-0">
                {loadingMessages ? (
                  <p className="text-muted-foreground text-sm">Carregando mensagens...</p>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda</p>
                    <p className="text-muted-foreground/70 text-xs mt-1">Envie ou receba uma mensagem para começar</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-col max-w-[75%]",
                          m.direction === "outbound" ? "ml-auto items-end" : "items-start"
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-[15px] shadow-sm max-w-full break-words overflow-hidden",
                            m.direction === "outbound"
                              ? "bg-[#25D366] text-white rounded-br-md"
                              : "bg-white border border-border rounded-bl-md"
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
                            m.body ?? "(mídia)"
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                          {formatTime(m.sent_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2 items-center bg-card">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendInChat();
                    }
                  }}
                  placeholder="Digite uma mensagem..."
                  className="min-h-11 flex-1"
                />
                <Button
                  onClick={handleSendInChat}
                  disabled={sendingReply || !replyText.trim()}
                  size="icon"
                  className="rounded-lg h-11 w-11 shrink-0 bg-[#25D366] hover:bg-[#20bd5a] text-white"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
                  <MessageSquare className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="font-medium">Selecione uma conversa</p>
                <p className="text-muted-foreground text-sm mt-1">ou use o botão + para iniciar uma nova</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent
          title="Nova conversa"
          onClose={() => setNewChatOpen(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Número (ex: 5511999999999)</label>
              <Input
                value={newTo}
                onChange={(e) => setNewTo(e.target.value)}
                placeholder="5511999999999"
              />
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
              disabled={sending || !newTo.trim() || !newText.trim()}
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
