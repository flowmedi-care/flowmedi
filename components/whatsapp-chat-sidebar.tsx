"use client";

import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MessageSquare, Plus, Send } from "lucide-react";
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

  const loadMessages = () => {
    if (!selectedId) return;
    setLoadingMessages(true);
    fetch(`/api/whatsapp/messages?conversationId=${encodeURIComponent(selectedId)}`)
      .then((res) => (res.ok ? res.json() : []))
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
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
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
    setSendingReply(true);
    const text = replyText.trim();
    setReplyText("");
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selectedConversation.phone_number, text }),
      });
      if (res.ok) {
        loadMessages();
      }
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex h-full min-h-0",
          fullWidth ? "flex-col sm:flex-row" : "flex-row"
        )}
      >
        <div
          className={cn(
            "flex flex-col border-r border-border bg-muted/30 min-w-0",
            fullWidth ? "w-full sm:w-80 sm:min-h-[200px]" : "w-80"
          )}
        >
          <div className="flex items-center justify-between gap-2 p-2 border-b border-border">
            <span className="font-medium text-sm truncate">Conversas</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewChatOpen(true)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-3 text-muted-foreground text-sm">Carregando...</p>
            ) : conversations.length === 0 ? (
              <p className="p-3 text-muted-foreground text-sm">
                Nenhuma conversa. Use &quot;+&quot; para nova conversa.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors",
                        selectedId === c.id && "bg-muted"
                      )}
                    >
                      <span className="font-medium">{c.phone_number}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background">
          {selectedId ? (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center">
                <span className="font-semibold text-sm truncate">
                  {selectedConversation?.phone_number ?? selectedId}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <p className="text-muted-foreground text-sm">Carregando...</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex flex-col max-w-[85%]",
                        m.direction === "outbound" ? "ml-auto items-end" : "items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          m.direction === "outbound"
                            ? "bg-[#005c4b] text-white rounded-br-md"
                            : "bg-[#202c33] text-[#e9edef] rounded-bl-md"
                        )}
                      >
                        {m.body ?? "(mídia)"}
                      </div>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {formatTime(m.sent_at)}
                      </span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2 items-end">
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
                  className="min-h-10 flex-1 rounded-full border-2 focus-visible:ring-2"
                />
                <Button
                  onClick={handleSendInChat}
                  disabled={sendingReply || !replyText.trim()}
                  size="icon"
                  className="rounded-full h-10 w-10 shrink-0 bg-[#005c4b] hover:bg-[#004d40]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Selecione uma conversa ou use + para nova conversa.</p>
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
