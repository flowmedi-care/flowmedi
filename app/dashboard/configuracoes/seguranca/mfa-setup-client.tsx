"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useMfaEnrollment } from "@/components/compliance/use-mfa-enrollment";

export function MfaSetupClient({ initialEnrolled }: { initialEnrolled: boolean }) {
  const router = useRouter();
  const [verifyCode, setVerifyCode] = useState("");
  const {
    loading,
    checking,
    enrolled,
    hasStaleFactor,
    qr,
    clearStaleFactors,
    startEnrollment,
    confirmEnrollment,
  } = useMfaEnrollment();

  const isEnrolled = enrolled || initialEnrolled;

  async function handleClearStale() {
    const res = await clearStaleFactors();
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("Configuração incompleta removida. Você pode recomeçar.", "success");
  }

  async function handleStart() {
    const res = await startEnrollment();
    if (res.error) {
      toast(res.error, "error");
      return;
    }
  }

  async function handleConfirm() {
    if (!verifyCode.trim()) {
      toast("Informe o código do aplicativo autenticador.", "error");
      return;
    }
    const res = await confirmEnrollment(verifyCode.trim());
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("MFA ativado com sucesso.", "success");
    setVerifyCode("");
    router.refresh();
  }

  if (checking) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">Carregando…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Autenticação em dois fatores (MFA)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        {hasStaleFactor && !isEnrolled && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
            <p className="text-foreground font-medium">Configuração incompleta detectada</p>
            <p>
              Uma tentativa anterior de MFA não foi finalizada. Remova e configure novamente.
            </p>
            <Button type="button" size="sm" variant="outline" disabled={loading} onClick={handleClearStale}>
              Remover e recomeçar
            </Button>
          </div>
        )}

        {isEnrolled ? (
          <p className="text-foreground">
            MFA TOTP está ativo nesta conta. No próximo login, use o código do aplicativo após a
            senha.
          </p>
        ) : (
          <>
            <p>
              Recomendado: adicione uma camada extra de proteção ao painel com Google Authenticator,
              Authy ou similar. O MFA é opcional — se ativar, o código será pedido a cada login por
              senha.
            </p>
            {!qr ? (
              <Button type="button" onClick={handleStart} disabled={loading}>
                Iniciar configuração
              </Button>
            ) : (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR Code MFA" className="h-40 w-40 rounded border border-border" />
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="mfa-code">Código de verificação</Label>
                  <Input
                    id="mfa-code"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="000000"
                    inputMode="numeric"
                  />
                </div>
                <Button type="button" onClick={handleConfirm} disabled={loading}>
                  Confirmar MFA
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
