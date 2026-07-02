"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import { needsMfaVerificationAtLogin, verifyTotpLogin } from "@/lib/compliance/mfa-service";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { AuthRecoveryHandler } from "@/components/auth/auth-recovery-handler";
import { cn } from "@/lib/utils";

interface SignInFormProps {
  redirectTo?: string;
  oauthError?: boolean;
  recoveryError?: boolean;
}

type LoginStep = "credentials" | "mfa";

export function SignInForm({ redirectTo, oauthError, recoveryError }: SignInFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (recoveryError) {
      return "O link de redefinição expirou ou já foi usado. Solicite um novo link em Esqueci minha senha.";
    }
    if (oauthError) {
      return "Não foi possível entrar com Google. Tente novamente ou use e-mail e senha.";
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  async function finishLogin(supabase: ReturnType<typeof createClient>, userId: string) {
    const path = await resolvePostAuthRedirect(supabase, userId, redirectTo);
    router.refresh();
    router.push(path);
    setLoading(false);
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setError("Erro ao obter sessão. Tente novamente.");
      return;
    }

    const needsMfa = await needsMfaVerificationAtLogin(supabase);
    if (needsMfa) {
      setLoading(false);
      setStep("mfa");
      return;
    }

    await finishLogin(supabase, user.id);
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!mfaCode.trim()) {
      setError("Informe o código de 6 dígitos do aplicativo.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const verify = await verifyTotpLogin(supabase, mfaCode.trim());
    if (verify.error) {
      setLoading(false);
      setError(verify.error);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("Erro ao obter sessão. Tente novamente.");
      return;
    }

    await finishLogin(supabase, user.id);
  }

  if (step === "mfa") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-muted/30 p-4 flex gap-3">
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Verificação em dois fatores</p>
            <p className="text-muted-foreground mt-1">
              Abra o Google Authenticator ou Authy e digite o código de 6 dígitos.
            </p>
          </div>
        </div>

        <form onSubmit={handleMfaSubmit} className="space-y-5">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="mfa-code">Código do autenticador</Label>
            <Input
              id="mfa-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="bg-muted/30 tracking-widest text-center text-lg"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Verificando…" : "Verificar e entrar"}
          </Button>

          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setStep("credentials");
              setMfaCode("");
              setError(null);
            }}
          >
            Voltar para senha
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <AuthRecoveryHandler onRecoveryError={setError} />
      </Suspense>
      <GoogleSignInButton redirectTo={redirectTo} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-card text-muted-foreground">ou</span>
        </div>
      </div>

      <form onSubmit={handleCredentialsSubmit} className="space-y-5">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">
            E-mail <span className="text-primary">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="bg-muted/30"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            Senha <span className="text-primary">*</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={isPasswordVisible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              autoComplete="current-password"
              className="bg-muted/30 pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              onClick={() => setIsPasswordVisible(!isPasswordVisible)}
              aria-label={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
            >
              {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          className="pt-1"
        >
          <Button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full h-10 relative overflow-hidden",
              isHovered && "shadow-lg shadow-primary/20"
            )}
          >
            <span className="flex items-center justify-center">
              {loading ? "Entrando…" : "Entrar"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </span>
            {isHovered && !loading && (
              <motion.span
                initial={{ left: "-100%" }}
                animate={{ left: "100%" }}
                transition={{ duration: 1, ease: "easeInOut" }}
                className="absolute top-0 bottom-0 left-0 w-20 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none"
                style={{ filter: "blur(8px)" }}
              />
            )}
          </Button>
        </motion.div>

        <div className="text-center">
          <Link
            href="/esqueci-senha"
            className="text-primary hover:text-primary/80 text-sm transition-colors hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
      </form>
    </div>
  );
}
