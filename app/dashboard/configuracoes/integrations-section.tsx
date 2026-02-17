"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Mail, Loader2, ExternalLink, AlertCircle, HelpCircle } from "lucide-react";

interface Integration {
  id: string;
  integration_type: "email_google" | "whatsapp_meta";
  status: "pending" | "connected" | "error" | "disconnected";
  metadata: { email?: string; phone?: string; phone_number_id?: string };
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
  const [whatsappPhoneIdInput, setWhatsappPhoneIdInput] = useState("");
  const [savingPhoneId, setSavingPhoneId] = useState(false);
  const [phoneIdError, setPhoneIdError] = useState<string | null>(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; debug?: unknown } | null>(null);

  useEffect(() => {
    loadIntegrations();
    
    // Verificar mensagens de sucesso/erro na URL
    const status = searchParams.get("status");
    const integration = searchParams.get("integration");
    const error = searchParams.get("error");
    
    if (status === "connected") {
      if (integration === "email") {
        setSuccessMessage("Conta do Google conectada com sucesso!");
      } else if (integration === "whatsapp") {
        setSuccessMessage("Conta do WhatsApp conectada com sucesso!");
      }
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
        oauth_error: "Erro na autenticação OAuth",
        config_missing: "Configuração do Meta não encontrada",
        token_failed: "Erro ao obter token de acesso",
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

  async function connectWhatsApp() {
    setConnecting("whatsapp_meta");
    try {
      const res = await fetch("/api/integrations/whatsapp/auth");
      if (!res.ok) throw new Error("Erro ao iniciar autenticação");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Erro ao conectar WhatsApp:", error);
      setConnecting(null);
    }
  }

  async function sendTestWhatsApp() {
    if (!testPhoneNumber.trim()) {
      setTestResult({ ok: false, message: "Informe o número para teste" });
      return;
    }
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testPhoneNumber.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({
          ok: true,
          message: "Mensagem de teste enviada! Verifique o WhatsApp (template hello_world).",
          debug: data.debug,
        });
        setTestPhoneNumber("");
      } else {
        setTestResult({
          ok: false,
          message: data.error || "Erro ao enviar",
          debug: data.debug,
        });
      }
    } catch (error) {
      setTestResult({ ok: false, message: "Erro de conexão" });
    } finally {
      setSendingTest(false);
    }
  }

  async function saveWhatsAppPhoneId() {
    if (!whatsappPhoneIdInput.trim()) {
      setPhoneIdError("Informe o Phone Number ID");
      return;
    }
    setSavingPhoneId(true);
    setPhoneIdError(null);
    try {
      const res = await fetch("/api/integrations/whatsapp/set-phone-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number_id: whatsappPhoneIdInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneIdError(data.error || "Erro ao salvar");
        return;
      }
      setSuccessMessage("Phone Number ID salvo. Agora você pode enviar mensagens.");
      setWhatsappPhoneIdInput("");
      setTimeout(() => setSuccessMessage(null), 5000);
      await loadIntegrations();
    } catch (error) {
      setPhoneIdError("Erro de conexão");
    } finally {
      setSavingPhoneId(false);
    }
  }

  async function disconnectWhatsApp() {
    if (!confirm("Tem certeza que deseja desconectar a conta do WhatsApp? Você não poderá mais enviar mensagens até reconectar.")) {
      return;
    }

    setDisconnecting("whatsapp_meta");
    try {
      const res = await fetch("/api/integrations/whatsapp/disconnect", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erro ao desconectar");
      await loadIntegrations();
    } catch (error) {
      console.error("Erro ao desconectar WhatsApp:", error);
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-50 rounded-lg shrink-0">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="font-medium">Email (Google)</div>
              <div className="text-sm text-muted-foreground break-words">
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

        {/* WhatsApp - Meta */}
        <div className="p-4 border rounded-lg space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-green-50 rounded-lg shrink-0">
                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <div className="font-medium">WhatsApp (Meta)</div>
                <div className="text-sm text-muted-foreground break-words">
                  {whatsappIntegration?.status === "connected" ? (
                    <>
                      Conectado
                      {whatsappIntegration.metadata?.phone_number_id ? (
                        <> — Número configurado</>
                      ) : (
                        <> — Informe o Phone Number ID abaixo</>
                      )}
                    </>
                  ) : whatsappIntegration?.status === "pending" ? (
                    "Conectado parcialmente — informe o Phone Number ID abaixo"
                  ) : (
                    "Conecte sua conta Meta Business para enviar mensagens"
                  )}
                </div>
                {whatsappIntegration?.error_message && (
                  <div className="text-xs text-destructive mt-1">
                    {whatsappIntegration.error_message}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {whatsappIntegration?.status === "connected" || whatsappIntegration?.status === "pending" ? (
                <>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {whatsappIntegration.metadata?.phone_number_id ? "Pronto para enviar" : "Conectado"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectWhatsApp}
                    disabled={disconnecting === "whatsapp_meta"}
                  >
                    {disconnecting === "whatsapp_meta" ? (
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
                  onClick={connectWhatsApp}
                  disabled={connecting === "whatsapp_meta"}
                  size="sm"
                >
                  {connecting === "whatsapp_meta" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Conectar WhatsApp
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Campo para informar Phone Number ID quando conectado mas sem número */}
          {(whatsappIntegration?.status === "connected" || whatsappIntegration?.status === "pending") && !whatsappIntegration?.metadata?.phone_number_id && (
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <Label className="font-normal text-muted-foreground">
                  A Meta não retornou o número automaticamente (erro 400). Cole o <strong>Phone Number ID</strong> do painel do app:
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Meta for Developers → seu app → WhatsApp → Configuração da API → em &quot;Enviar e receber mensagens&quot;, copie o <strong>Identificação do número de telefone</strong> (ex.: 991699937359869).
              </p>
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Ex.: 991699937359869"
                  value={whatsappPhoneIdInput}
                  onChange={(e) => {
                    setWhatsappPhoneIdInput(e.target.value);
                    setPhoneIdError(null);
                  }}
                  className="max-w-xs font-mono text-sm"
                />
                <Button
                  size="sm"
                  onClick={saveWhatsAppPhoneId}
                  disabled={savingPhoneId || !whatsappPhoneIdInput.trim()}
                >
                  {savingPhoneId ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar número"
                  )}
                </Button>
              </div>
              {phoneIdError && (
                <p className="text-xs text-destructive">{phoneIdError}</p>
              )}
            </div>
          )}

          {/* Enviar mensagem de teste — só quando estiver pronto para enviar */}
          {(whatsappIntegration?.status === "connected" || whatsappIntegration?.status === "pending") && whatsappIntegration?.metadata?.phone_number_id && (
            <div className="pt-3 border-t border-border space-y-2">
              <Label className="text-sm font-medium">Enviar mensagem de teste</Label>
              <p className="text-xs text-muted-foreground">
                Digite um número com DDI (ex: 5562999999999). Usamos o template &quot;hello_world&quot; (como no painel da Meta). Se não chegar nem no painel da Meta: adicione o número como destinatário de teste em WhatsApp → Configuração da API → &quot;Até&quot;.
              </p>
              <div className="flex gap-2 flex-wrap items-center">
                <Input
                  placeholder="5562999999999"
                  value={testPhoneNumber}
                  onChange={(e) => {
                    setTestPhoneNumber(e.target.value);
                    setTestResult(null);
                  }}
                  className="max-w-xs font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={sendTestWhatsApp}
                  disabled={sendingTest || !testPhoneNumber.trim()}
                >
                  {sendingTest ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar teste"
                  )}
                </Button>
              </div>
              {testResult && (
                <div className="space-y-1">
                  <p className={`text-sm ${testResult.ok ? "text-green-600" : "text-destructive"}`}>
                    {testResult.ok ? "✓ " : ""}{testResult.message}
                  </p>
                  {testResult.debug != null && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver resposta da API (debug)
                      </summary>
                      <pre className="mt-1 p-2 rounded bg-muted overflow-auto max-h-40 font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(testResult.debug, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
