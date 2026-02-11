"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Mail, Loader2, ExternalLink, AlertCircle } from "lucide-react";

interface Integration {
  id: string;
  integration_type: "email_google" | "whatsapp_meta";
  status: "pending" | "connected" | "error" | "disconnected";
  metadata: { email?: string; phone?: string };
  connected_at: string | null;
  last_sync_at: string | null;
  error_message: string | null;
}

interface IntegrationsSectionProps {
  clinicId: string;
}

export function IntegrationsSection({ clinicId }: IntegrationsSectionProps) {
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
    
    // Verificar mensagens de sucesso/erro na URL
    const status = searchParams.get("status");
    const integration = searchParams.get("integration");
    const error = searchParams.get("error");
    
    if (status === "connected" && integration === "email") {
      setSuccessMessage("Conta do Google conectada com sucesso!");
      setTimeout(() => setSuccessMessage(null), 5000);
    }
    
    if (error) {
      const errorMessages: Record<string, string> = {
        oauth_failed: "Falha na autenticação OAuth",
        invalid_state: "Estado inválido na autenticação",
        unauthorized: "Não autorizado",
        no_token: "Não foi possível obter o token de acesso",
        no_email: "Não foi possível obter o email da conta",
        save_failed: "Erro ao salvar a integração",
        callback_failed: "Erro no callback de autenticação",
      };
      setErrorMessage(errorMessages[error] || "Erro desconhecido");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  }, [clinicId, searchParams]);

  async function loadIntegrations() {
    try {
      const res = await fetch("/api/integrations");
      if (!res.ok) throw new Error("Erro ao carregar integrações");
      const data = await res.json();
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error("Erro ao carregar integrações:", error);
    } finally {
      setLoading(false);
    }
  }

  async function connectGoogle() {
    setConnecting("email_google");
    try {
      const res = await fetch("/api/integrations/google/auth");
      if (!res.ok) throw new Error("Erro ao iniciar autenticação");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Erro ao conectar Google:", error);
      setConnecting(null);
    }
  }

  async function disconnectGoogle() {
    if (!confirm("Tem certeza que deseja desconectar a conta do Google? Você não poderá mais enviar emails até reconectar.")) {
      return;
    }

    setDisconnecting("email_google");
    try {
      const res = await fetch("/api/integrations/google/disconnect", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erro ao desconectar");
      await loadIntegrations();
    } catch (error) {
      console.error("Erro ao desconectar Google:", error);
    } finally {
      setDisconnecting(null);
    }
  }

  const emailIntegration = integrations.find((i) => i.integration_type === "email_google");
  const whatsappIntegration = integrations.find((i) => i.integration_type === "whatsapp_meta");

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
          <CardDescription>Conecte suas contas para enviar emails e mensagens</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrações</CardTitle>
        <CardDescription>
          Conecte suas contas para enviar emails e mensagens aos pacientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}
        
        {/* Email - Google */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium">Email (Google)</div>
              <div className="text-sm text-muted-foreground">
                {emailIntegration?.status === "connected" ? (
                  <>
                    Conectado como <strong>{emailIntegration.metadata.email}</strong>
                  </>
                ) : (
                  "Conecte sua conta do Google para enviar emails"
                )}
              </div>
              {emailIntegration?.error_message && (
                <div className="text-xs text-destructive mt-1">
                  {emailIntegration.error_message}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {emailIntegration?.status === "connected" ? (
              <>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnectGoogle}
                  disabled={disconnecting === "email_google"}
                >
                  {disconnecting === "email_google" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Desconectando...
                    </>
                  ) : (
                    "Desconectar"
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={connectGoogle}
                disabled={connecting === "email_google"}
                size="sm"
              >
                {connecting === "email_google" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Conectar Google
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* WhatsApp - Meta (placeholder para futuro) */}
        <div className="flex items-center justify-between p-4 border rounded-lg opacity-60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </div>
            <div>
              <div className="font-medium">WhatsApp (Meta)</div>
              <div className="text-sm text-muted-foreground">
                Em breve: conecte sua conta Meta Business para enviar mensagens
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled>
            Em breve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
