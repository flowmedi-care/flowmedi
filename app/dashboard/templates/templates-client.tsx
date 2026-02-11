"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, MessageSquare, Plus, Loader2 } from "lucide-react";
import { TestEmailSection } from "../configuracoes/test-email-section";

interface Template {
  id: string;
  name: string;
  channel: "email" | "whatsapp" | "both";
  type: string;
  subject: string | null;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplatesClientProps {
  clinicId: string;
  initialTemplates: Template[];
}

export function TemplatesClient({ clinicId, initialTemplates }: TemplatesClientProps) {
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">("email");
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);

  const emailTemplates = templates.filter((t) => t.channel === "email" || t.channel === "both");
  const whatsappTemplates = templates.filter((t) => t.channel === "whatsapp" || t.channel === "both");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie templates de emails e mensagens WhatsApp para comunicação com pacientes
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === "email" ? "default" : "ghost"}
          onClick={() => setActiveTab("email")}
          className="rounded-b-none"
        >
          <Mail className="h-4 w-4 mr-2" />
          Email
        </Button>
        <Button
          variant={activeTab === "whatsapp" ? "default" : "ghost"}
          onClick={() => setActiveTab("whatsapp")}
          className="rounded-b-none"
          disabled
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          WhatsApp
          <span className="ml-2 text-xs opacity-70">(Em breve)</span>
        </Button>
      </div>

      {/* Conteúdo da aba Email */}
      {activeTab === "email" && (
        <div className="space-y-6">
          {/* Seção de teste */}
          <TestEmailSection />

          {/* Lista de templates (placeholder para futuro) */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Templates de Email</CardTitle>
                  <CardDescription>
                    Crie e gerencie templates de email para enviar aos pacientes
                  </CardDescription>
                </div>
                <Button variant="outline" disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {emailTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm mb-1">Nenhum template de email cadastrado</p>
                  <p className="text-xs">Use a seção acima para testar o envio de emails</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {emailTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <h3 className="font-medium">{template.name}</h3>
                        <p className="text-sm text-muted-foreground">{template.type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {template.is_active ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            Inativo
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conteúdo da aba WhatsApp */}
      {activeTab === "whatsapp" && (
        <Card>
          <CardHeader>
            <CardTitle>Templates de WhatsApp</CardTitle>
            <CardDescription>
              Em breve: crie e gerencie templates de mensagens WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Funcionalidade em desenvolvimento</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
