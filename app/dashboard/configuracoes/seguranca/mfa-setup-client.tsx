"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

export function MfaSetupClient({ hasTotp }: { hasTotp: boolean }) {
  const searchParams = useSearchParams();
  const mfaRequired = searchParams.get("mfa_required") === "1";
  const mfaVerify = searchParams.get("mfa_verify") === "1";
  const [enrolled, setEnrolled] = useState(hasTotp);
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function startEnrollment() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setLoading(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    setQr(data.totp.qr_code);
    setFactorId(data.id);
  }

  async function confirmEnrollment() {
    if (!factorId || !verifyCode.trim()) {
      toast("Informe o código do aplicativo autenticador.", "error");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setLoading(false);
      toast(challenge.error.message, "error");
      return;
    }
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: verifyCode.trim(),
    });
    setLoading(false);
    if (verify.error) {
      toast(verify.error.message, "error");
      return;
    }
    setEnrolled(true);
    setQr(null);
    toast("MFA ativado com sucesso.", "success");
    if (mfaRequired) {
      window.location.href = "/dashboard";
    }
  }

  async function verifyExistingMfa() {
    if (!verifyCode.trim()) {
      toast("Informe o código do aplicativo autenticador.", "error");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.[0];
    if (!totp) {
      setLoading(false);
      toast("Nenhum fator TOTP encontrado.", "error");
      return;
    }
    const challenge = await supabase.auth.mfa.challenge({ factorId: totp.id });
    if (challenge.error) {
      setLoading(false);
      toast(challenge.error.message, "error");
      return;
    }
    const verify = await supabase.auth.mfa.verify({
      factorId: totp.id,
      challengeId: challenge.data.id,
      code: verifyCode.trim(),
    });
    setLoading(false);
    if (verify.error) {
      toast(verify.error.message, "error");
      return;
    }
    toast("Sessão verificada com MFA.", "success");
    window.location.href = "/dashboard";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Autenticação em dois fatores (MFA)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        {mfaRequired && !enrolled && (
          <p className="text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
            MFA é obrigatório para administradores e médicos. Configure antes de continuar.
          </p>
        )}

        {mfaVerify && enrolled && (
          <div className="space-y-3">
            <p className="text-foreground">
              Confirme o código do autenticador para elevar a segurança desta sessão.
            </p>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="mfa-session-code">Código</Label>
              <Input
                id="mfa-session-code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="000000"
                inputMode="numeric"
              />
            </div>
            <Button type="button" onClick={verifyExistingMfa} disabled={loading}>
              Verificar sessão
            </Button>
          </div>
        )}

        {(!mfaVerify || !enrolled) && (
          <>
            {enrolled ? (
              <p className="text-foreground">
                MFA TOTP está ativo nesta conta. Mantenha o aplicativo autenticador seguro.
              </p>
            ) : (
              <>
                <p>
                  Adicione uma camada extra de proteção ao painel. Use Google Authenticator, Authy
                  ou similar.
                </p>
                {!qr ? (
                  <Button type="button" onClick={startEnrollment} disabled={loading}>
                    Iniciar configuração
                  </Button>
                ) : (
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qr}
                      alt="QR Code MFA"
                      className="h-40 w-40 rounded border border-border"
                    />
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
                    <Button type="button" onClick={confirmEnrollment} disabled={loading}>
                      Confirmar MFA
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
