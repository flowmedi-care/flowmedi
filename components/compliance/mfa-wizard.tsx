"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Smartphone, QrCode, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useMfaEnrollment } from "@/components/compliance/use-mfa-enrollment";

const STEPS = [
  { id: "why", title: "Por quê?", icon: Shield },
  { id: "app", title: "Instalar app", icon: Smartphone },
  { id: "scan", title: "Escanear QR", icon: QrCode },
  { id: "done", title: "Pronto", icon: CheckCircle2 },
] as const;

type WizardMode = "onboarding" | "settings";

export function MfaWizard({ mode = "onboarding" }: { mode?: WizardMode }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
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

  const finishPath = "/dashboard";
  const stepMeta = STEPS[step];

  useEffect(() => {
    if (enrolled && step < 3) {
      setStep(3);
    }
  }, [enrolled, step]);

  async function handleNextFromApp() {
    if (hasStaleFactor) {
      const res = await clearStaleFactors();
      if (res.error) {
        toast(res.error, "error");
        return;
      }
    }
    const res = await startEnrollment();
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    setStep(2);
  }

  async function handleConfirmCode() {
    if (!verifyCode.trim()) {
      toast("Digite o código de 6 dígitos do aplicativo.", "error");
      return;
    }
    const res = await confirmEnrollment(verifyCode.trim());
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("Autenticação em dois fatores ativada!", "success");
    setStep(3);
  }

  function handleFinish() {
    if (mode === "onboarding") {
      window.location.href = finishPath;
    } else {
      router.refresh();
      router.push(finishPath);
    }
  }

  if (checking) {
    return <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`h-2 flex-1 max-w-16 rounded-full transition-colors ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
            aria-hidden
          />
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <stepMeta.icon className="h-5 w-5 text-primary" />
            <span>
              Passo {step + 1} de {STEPS.length}: {stepMeta.title}
            </span>
          </div>

          {step === 0 && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                O FlowMed armazena <strong className="text-foreground">dados de saúde</strong> dos
                pacientes. A autenticação em dois fatores (MFA) reduz o risco de acesso indevido
                mesmo que alguém descubra sua senha.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Você configura <strong className="text-foreground">uma única vez</strong> (QR code).</li>
                <li>Nos próximos logins, basta digitar o código de 6 dígitos do app após a senha.</li>
                <li>Exigência da LGPD para proteção de dados sensíveis (art. 46).</li>
              </ul>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Instale um aplicativo autenticador no celular:</p>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://support.google.com/accounts/answer/1066447"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Google Authenticator
                  </a>
                </li>
                <li>
                  <a
                    href="https://authy.com/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Authy
                  </a>
                </li>
              </ul>
              {hasStaleFactor && (
                <p className="text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
                  Há uma configuração incompleta. Ao continuar, ela será removida automaticamente.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {!qr ? (
                <p className="text-sm text-muted-foreground">Preparando QR code…</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Abra o app autenticador, escaneie o QR code e digite o código de 6 dígitos
                    gerado.
                  </p>
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qr}
                      alt="QR Code MFA"
                      className="h-44 w-44 rounded border border-border"
                    />
                  </div>
                  <div className="space-y-2 max-w-xs mx-auto">
                    <Label htmlFor="wizard-mfa-code">Código de verificação</Label>
                    <Input
                      id="wizard-mfa-code"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
              <p className="text-foreground font-medium">Conta protegida com sucesso!</p>
              <p className="text-sm text-muted-foreground">
                No próximo login, após sua senha, informe o código do aplicativo autenticador.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {step > 0 && step < 3 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={loading}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}

            {step === 0 && (
              <Button type="button" className="ml-auto" onClick={() => setStep(1)}>
                Entendi, continuar
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === 1 && (
              <Button type="button" className="ml-auto" onClick={handleNextFromApp} disabled={loading}>
                {loading ? "Preparando…" : "Já instalei, continuar"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === 2 && (
              <Button
                type="button"
                className="ml-auto"
                onClick={handleConfirmCode}
                disabled={loading || !qr}
              >
                {loading ? "Verificando…" : "Confirmar código"}
              </Button>
            )}

            {step === 3 && (
              <Button type="button" className="w-full sm:w-auto mx-auto" onClick={handleFinish}>
                Ir ao painel
              </Button>
            )}
          </div>

          {mode === "onboarding" && step < 3 && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              Dúvidas?{" "}
              <Link href="/encarregado-dados" className="text-primary underline-offset-2 hover:underline">
                Contato privacidade
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
