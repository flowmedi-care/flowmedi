"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function TestEmailSection() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Teste de Email - FlowMedi");
  const [body, setBody] = useState(
    "Olá!\n\nEste é um email de teste enviado através do FlowMedi.\n\nSe você recebeu esta mensagem, significa que a integração com o Google está funcionando corretamente!\n\nAtenciosamente,\nEquipe FlowMedi"
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  async function handleSendTest() {
    if (!to || !subject || !body) {
      setResult({ success: false, error: "Preencha todos os campos" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/integrations/email/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, subject, body }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, error: data.error || "Erro ao enviar email" });
      } else {
        setResult({ success: true, message: data.message || "Email enviado com sucesso!" });
        // Limpar campos após sucesso
        setTo("");
        setSubject("Teste de Email - FlowMedi");
        setBody(
          "Olá!\n\nEste é um email de teste enviado através do FlowMedi.\n\nSe você recebeu esta mensagem, significa que a integração com o Google está funcionando corretamente!\n\nAtenciosamente,\nEquipe FlowMedi"
        );
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Testar Envio de Email</CardTitle>
        <CardDescription>
          Envie um email de teste para verificar se a integração está funcionando corretamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <div
            className={`p-3 rounded-lg flex items-start gap-2 ${
              result.success
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">
                {result.success ? "Sucesso!" : "Erro"}
              </p>
              <p className="text-sm">{result.message || result.error}</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="test_email_to">Email destinatário *</Label>
          <Input
            id="test_email_to"
            type="email"
            placeholder="seu-email@exemplo.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="test_email_subject">Assunto *</Label>
          <Input
            id="test_email_subject"
            placeholder="Assunto do email"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="test_email_body">Mensagem *</Label>
          <Textarea
            id="test_email_body"
            placeholder="Corpo do email"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Use quebras de linha normalmente. Elas serão convertidas automaticamente para HTML.
          </p>
        </div>

        <Button onClick={handleSendTest} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Enviar Email de Teste
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
