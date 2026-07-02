"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Mail } from "lucide-react";

export function EmailVerificationCard({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResend() {
    setLoading(true);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);

    if (error) {
      toast(error.message, "error");
      return;
    }

    setSent(true);
    toast("E-mail de confirmação reenviado.", "success");
  }

  async function handleRefresh() {
    router.refresh();
  }

  return (
    <Card id="email">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Confirmação de e-mail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {verified ? (
          <div className="flex items-start gap-2 text-foreground">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
            <p>
              O e-mail <strong>{email}</strong> está confirmado.
            </p>
          </div>
        ) : (
          <>
            <p>
              Confirme o e-mail <strong className="text-foreground">{email}</strong> para ativar
              totalmente a conta. Verifique a caixa de entrada e o spam.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={loading} onClick={handleResend}>
                {loading ? "Enviando…" : sent ? "Reenviar novamente" : "Reenviar confirmação"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleRefresh}>
                Já confirmei
              </Button>
            </div>
            <p className="text-xs">
              Os e-mails de confirmação são enviados pelo Supabase Auth (configure Resend como SMTP
              no painel do Supabase).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
