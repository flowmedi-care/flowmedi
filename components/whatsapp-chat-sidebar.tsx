"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Loader2, AlertCircle, X, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  last_message_preview: string | null;
  unread_count: number;
  last_message_at: string;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  message_type: string;
  status: string;
  sent_at: string;
}

interface WhatsAppChatSidebarProps {
  /** Quando true, ocupa a área principal (página) em vez de sidebar fixa */
  fullWidth?: boolean;
}

export function WhatsAppChatSidebar({ fullWidth }: WhatsAppChatSidebarProps = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOutsideWindowDialog, setShowOutsideWindowDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{ conversationId: string; text: string } | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationTo, setNewConversationTo] = useState("");
  const [newConversationText, setNewConversationText] = useState("");
  const [sendingNew, setSendingNew] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000); // Atualizar a cada 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      const interval = setInterval(() => loadMessages(selectedConversation.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    try {
      const res = await fetch("/api/whatsapp/conversations");
      if (!res.ok) return [];
      const data = await res.json();
      const convs = data.conversations || [];
      setConversations(convs);
      setLoading(false);
      return convs;
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
      setLoading(false);
      return [];
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const res = await fetch(`/api/whatsapp/conversations/${conversationId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    }
  }

  async function sendMessage(conversationId: string, text: string, forceTemplate = false) {
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, text, forceTemplate }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "outside_24h_window") {
          setPendingMessage({ conversationId, text });
          setShowOutsideWindowDialog(true);
          return;
        }
        alert(data.error || "Erro ao enviar mensagem");
        return;
      }

      setMessageText("");
      await loadMessages(conversationId);
      await loadConversations();
    } catch (error) {
      alert("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    if (!selectedConversation || !messageText.trim() || sending) return;
    sendMessage(selectedConversation.id, messageText.trim());
  }

  function handleForceSend() {
    if (!pendingMessage) return;
    sendMessage(pendingMessage.conversationId, pendingMessage.text, true);
    setShowOutsideWindowDialog(false);
    setPendingMessage(null);
  }

  async function sendNewConversation() {
    if (!newConversationTo.trim() || !newConversationText.trim() || sendingNew) return;
    setSendingNew(true);
    try {
      const res = await fetch("/api/whatsapp/send-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: newConversationTo.trim(),
          text: newConversationText.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao enviar mensagem");
        return;
      }

      setNewConversationTo("");
      setNewConversationText("");
      setShowNewConversation(false);
      
      // Recarregar conversas e selecionar a criada
      const updatedConversations = await loadConversations();
      if (data.conversation_id) {
        const foundConv = updatedConversations.find((c: Conversation) => c.id === data.conversation_id);
        if (foundConv) {
          setSelectedConversation(foundConv);
        }
      }
    } catch (error) {
      alert("Erro ao enviar mensagem");
    } finally {
      setSendingNew(false);
    }
  }

  function formatPhoneNumber(phone: string): string {
    // Formatar: 5511999999999 -> (11) 99999-9999
    if (phone.length >= 13) {
      const ddd = phone.substring(2, 4);
      const part1 = phone.substring(4, 9);
      const part2 = phone.substring(9);
      return `(${ddd}) ${part1}-${part2}`;
    }
    return phone;
  }

  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  const containerClass = fullWidth
    ? "flex-1 min-w-0 rounded-lg border border-border bg-card flex flex-col min-h-0"
    : "w-80 border-l border-border bg-card flex flex-col h-full";

  if (loading) {
    return (
      <div className={fullWidth ? "flex-1 flex items-center justify-center rounded-lg border bg-card" : "w-80 border-l border-border bg-card flex items-center justify-center"}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className={containerClass}>
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold">WhatsApp</h3>
          </div>
          <div className="flex items-center gap-2">
            {!selectedConversation && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewConversation(true)}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova conversa
              </Button>
            )}
            {selectedConversation && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedConversation(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {!selectedConversation ? (
          /* Lista de conversas */
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 space-y-1">
              {conversations.length === 0 && !showNewConversation ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma conversa ainda. Use &quot;Nova conversa&quot; para enviar uma mensagem de teste.
                </div>
              ) : showNewConversation ? (
                /* Formulário nova conversa */
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Nova conversa</h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setShowNewConversation(false);
                        setNewConversationTo("");
                        setNewConversationText("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-to">Número (com DDI)</Label>
                    <Input
                      id="new-to"
                      placeholder="5562996915034"
                      value={newConversationTo}
                      onChange={(e) => setNewConversationTo(e.target.value.replace(/\D/g, ""))}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato: código do país + DDD + número (ex.: 5562996915034)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-text">Mensagem</Label>
                    <textarea
                      id="new-text"
                      placeholder="Digite sua mensagem..."
                      value={newConversationText}
                      onChange={(e) => setNewConversationText(e.target.value)}
                      className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                      disabled={sendingNew}
                    />
                  </div>
                  <Button
                    onClick={sendNewConversation}
                    disabled={sendingNew || !newConversationTo.trim() || !newConversationText.trim()}
                    className="w-full"
                  >
                    {sendingNew ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar mensagem
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className="w-full p-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {conv.contact_name || formatPhoneNumber(conv.phone_number)}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {conv.last_message_preview || "Sem mensagens"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatTime(conv.last_message_at)}
                        </span>
                        {conv.unread_count > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 text-xs">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Chat */
          <div className="flex flex-col flex-1 min-h-0">
            {/* Header da conversa */}
            <div className="p-4 border-b border-border">
              <div className="font-medium">
                {selectedConversation.contact_name || formatPhoneNumber(selectedConversation.phone_number)}
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedConversation.phone_number}
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        msg.direction === "outbound"
                          ? "bg-green-500 text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
                      <div
                        className={`text-xs mt-1 ${
                          msg.direction === "outbound" ? "text-green-100" : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(msg.sent_at)}
                        {msg.direction === "outbound" && (
                          <span className="ml-1">
                            {msg.status === "read" ? "✓✓" : msg.status === "delivered" ? "✓" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sending}
                />
                <Button onClick={handleSend} disabled={sending || !messageText.trim()} size="icon">
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialog para fora da janela de 24h */}
      {showOutsideWindowDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-4 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold">Fora da janela de 24 horas</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Esta mensagem será enviada como template (cobrado pela Meta). Deseja continuar?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowOutsideWindowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleForceSend}>Enviar mesmo assim</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
