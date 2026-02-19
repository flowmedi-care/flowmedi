"use client";

import React, { useEffect, useState } from "react";
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
  const [error24hOpen, setError24hOpen] = useState(false);

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

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    fetch(`/api/whatsapp/messages?conversationId=${encodeURIComponent(selectedId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [selectedId]);

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
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewChatOpen(false);
        setNewTo("");
        setNewText("");
        loadConversations();
      } else if (data.error === "outside_24h") {
        setError24hOpen(true);
      }
    } finally {
      setSending(false);
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
                Nenhuma conversa. Use &quot;Nova conversa&quot; para enviar.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
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

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {selectedId ? (
            <>
              <div className="p-2 border-b border-border font-medium text-sm truncate">
                {selectedConversation?.phone_number ?? selectedId}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingMessages ? (
                  <p className="text-muted-foreground text-sm">Carregando...</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        m.direction === "outbound"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {m.body ?? "(mídia)"}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Selecione uma conversa ou inicie uma nova.</p>
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

      <Dialog open={error24hOpen} onOpenChange={setError24hOpen}>
        <DialogContent
          title="Janela de 24 horas"
          onClose={() => setError24hOpen(false)}
        >
          <p className="text-sm text-muted-foreground">
            Só é possível enviar mensagem de texto se o paciente tiver enviado uma mensagem nas últimas 24 horas. Use um template aprovado pela Meta para o primeiro contato.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
