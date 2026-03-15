"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { EmailBrandingCard } from "../templates/email-branding-card";

export function EmailSettingsClient() {
  const router = useRouter();
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Configurações de email</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Teste de envio e configuração de cabeçalho/rodapé dos emails.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/mensagens")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Mensagens
        </Button>
      </div>

      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2 sm:text-lg">
          <Mail className="h-5 w-5 shrink-0" />
          Enviar email de teste
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Verifica se a integração com Gmail está funcionando corretamente.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-2 w-full sm:min-w-[220px] sm:max-w-[320px]">
            <Label htmlFor="test-email-to">Destinatário (email)</Label>
            <Input
              id="test-email-to"
              type="email"
              placeholder="email@exemplo.com"
              value={testEmailTo}
              onChange={(e) => {
                setTestEmailTo(e.target.value);
                setTestEmailResult(null);
              }}
            />
          </div>
          <Button
            disabled={!testEmailTo.trim() || testEmailSending}
            onClick={async () => {
              setTestEmailSending(true);
              setTestEmailResult(null);
              try {
                const res = await fetch("/api/integrations/email/test", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: testEmailTo.trim(),
                    subject: "Teste FlowMedi",
                    body: "Este é um email de teste enviado pelo FlowMedi. Se você recebeu esta mensagem, a integração com o Gmail está funcionando.",
                  }),
                });
                const data = await res.json();
                if (res.ok && data.success) {
                  setTestEmailResult({ ok: true, message: "Email enviado com sucesso!" });
                } else {
                  setTestEmailResult({ ok: false, message: data.error || "Erro ao enviar." });
                }
              } catch {
                setTestEmailResult({ ok: false, message: "Erro de conexão." });
              } finally {
                setTestEmailSending(false);
              }
            }}
          >
            {testEmailSending ? (
              "Enviando..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar teste
              </>
            )}
          </Button>
        </div>
        {testEmailResult && (
          <p className={`mt-3 text-sm ${testEmailResult.ok ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
            {testEmailResult.message}
          </p>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-foreground mb-4 sm:text-lg">Cabeçalho e rodapé</h2>
        <EmailBrandingCard />
      </Card>
    </div>
  );
}
