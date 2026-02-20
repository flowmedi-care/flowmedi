"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MessageSquare, Plus, Send, Phone, Info, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppContactSidebar, type Patient } from "./whatsapp-contact-sidebar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Conversation = {
  id: string;
  phone_number: string;
  contact_name: string | null;
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
  const [contactSidebarOpen, setContactSidebarOpen] = useState(false);
  const [patientByPhone, setPatientByPhone] = useState<Record<string, Patient>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(false);

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

  const handleDeleteConversation = async (conversationId: string) => {
    setDeletingConversationId(conversationId);
    try {
      const res = await fetch(`/api/whatsapp/delete-conversation?conversationId=${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelectedId(null);
        setMessages([]);
        await loadConversations();
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

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        const convos = data as Conversation[];
        const map: Record<string, Patient> = {};
        await Promise.all(
          convos.map(async (c) => {
            const patient = await fetchPatientByPhone(c.phone_number);
            if (patient) map[c.phone_number] = patient;
          })
        );
        setPatientByPhone((prev) => ({ ...prev, ...map }));
        await loadUnreadCounts();
      } else {
        setConversations([]);
      }
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = (showLoading = false, scrollToBottom = false) => {
    if (!selectedId) return;
    if (showLoading) setLoadingMessages(true);
    fetch(`/api/whatsapp/messages?conversationId=${encodeURIComponent(selectedId)}`)
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => {
        if (scrollToBottom) shouldScrollToBottomRef.current = true;
        setMessages(data);
      })
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
    // Marcar conversa como visualizada ao abrir
    fetch("/api/whatsapp/mark-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId }),
    }).then(() => {
      // Remover badge imediatamente da conversa atual
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        delete updated[selectedId];
        // Atualizar total também
        const newTotal = Object.values(updated).reduce((sum, count) => sum + count, 0);
        window.dispatchEvent(new CustomEvent("whatsapp-unread-update", { detail: newTotal }));
        return updated;
      });
      loadUnreadCounts(); // Atualizar contadores após marcar como visualizada
    });
    loadMessages(true, true); // loading + scroll no primeiro carregamento
    const interval = setInterval(() => {
      loadMessages(false, false);
      loadUnreadCounts(); // Atualizar contadores periodicamente
    }, 5000); // polling sem mexer no scroll
    return () => clearInterval(interval);
  }, [selectedId, loadUnreadCounts]);

  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      shouldScrollToBottomRef.current = false;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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
        loadUnreadCounts();
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
    shouldScrollToBottomRef.current = true; // rolar ao enviar
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
        loadUnreadCounts();
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
                        <div className="flex items-center gap-2">
                          <span className="block font-medium truncate flex-1">
                            {patientByPhone[c.phone_number]?.full_name ?? 
                             c.contact_name ?? 
                             formatPhone(c.phone_number)}
                          </span>
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
                <span className="font-semibold truncate flex-1 min-w-0">
                  {selectedConversation
                    ? patientByPhone[selectedConversation.phone_number]?.full_name ??
                      selectedConversation.contact_name ??
                      formatPhone(selectedConversation.phone_number)
                    : selectedId}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => setContactSidebarOpen(true)}
                  title="Informações do contato"
                >
                  <Info className="h-5 w-5" />
                </Button>
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
                            <div className="px-3 py-1 bg-muted/50 rounded-full">
                              <span className="text-xs text-muted-foreground font-medium">{group.dateLabel}</span>
                            </div>
                          </div>
                          {/* Mensagens do grupo */}
                          {group.messages.map((m) => (
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
                        </React.Fragment>
                      ));
                    })()}
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
