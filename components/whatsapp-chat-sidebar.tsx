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
            "flex flex-col border-r border-border bg-[#111b21] min-w-0",
            fullWidth ? "w-full sm:w-80 sm:min-h-[200px]" : "w-80"
          )}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#2a3942]">
            <span className="font-semibold text-sm text-[#e9edef] truncate">Conversas</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNewChatOpen(true)}
              className="shrink-0 h-9 w-9 text-[#aebac1] hover:text-[#e9edef] hover:bg-[#202c33]"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-[#8696a0] text-sm">Carregando...</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-[#8696a0] text-sm">
                Nenhuma conversa ainda. Use o botão acima para iniciar.
              </p>
            ) : (
              <ul className="divide-y divide-[#2a3942]">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#202c33] transition-colors",
                        selectedId === c.id && "bg-[#2a3942]"
                      )}
                    >
                      <div className="flex h-12 w-12 rounded-full bg-[#6a7175] items-center justify-center shrink-0">
                        <Phone className="h-6 w-6 text-[#e9edef]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block font-medium text-[#e9edef] truncate">{c.phone_number}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#0b141a]">
          {selectedId ? (
            <>
              <div className="px-4 py-3 border-b border-[#2a3942] flex items-center gap-3 bg-[#202c33]">
                <div className="flex h-10 w-10 rounded-full bg-[#6a7175] items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-[#e9edef]" />
                </div>
                <span className="font-semibold text-[#e9edef] truncate">
                  {selectedConversation?.phone_number ?? selectedId}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-[#0b141a]">
                {loadingMessages ? (
                  <p className="text-[#8696a0] text-sm">Carregando mensagens...</p>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-16 w-16 text-[#2a3942] mb-3" />
                    <p className="text-[#8696a0] text-sm">Nenhuma mensagem ainda</p>
                    <p className="text-[#667781] text-xs mt-1">Envie ou receba uma mensagem para começar</p>
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
                            "rounded-lg px-3 py-2 text-sm shadow-md max-w-full break-words",
                            m.direction === "outbound"
                              ? "bg-[#005c4b] text-[#e9edef] rounded-br-sm"
                              : "bg-[#202c33] text-[#e9edef] rounded-bl-sm"
                          )}
                        >
                          {m.body ?? "(mídia)"}
                        </div>
                        <span className="text-[10px] text-[#667781] mt-0.5 px-1">
                          {formatTime(m.sent_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-[#2a3942] flex gap-2 items-center bg-[#202c33]">
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
                  className="min-h-11 flex-1 rounded-lg border-[#2a3942] bg-[#2a3942] text-[#e9edef] placeholder:text-[#8696a0] focus-visible:ring-2 focus-visible:ring-[#005c4b]"
                />
                <Button
                  onClick={handleSendInChat}
                  disabled={sendingReply || !replyText.trim()}
                  size="icon"
                  className="rounded-lg h-11 w-11 shrink-0 bg-[#005c4b] hover:bg-[#006d5b] text-white"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#0b141a]">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#202c33] mb-4">
                  <MessageSquare className="h-10 w-10 text-[#667781]" />
                </div>
                <p className="text-[#e9edef] font-medium">Selecione uma conversa</p>
                <p className="text-[#8696a0] text-sm mt-1">ou use o botão + para iniciar uma nova</p>
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
