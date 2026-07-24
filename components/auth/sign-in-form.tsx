"use client";

import { useState, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { AuthRecoveryHandler } from "@/components/auth/auth-recovery-handler";
import { RecaptchaV2 } from "@/components/auth/recaptcha-v2";
import { cn } from "@/lib/utils";

interface SignInFormProps {
  redirectTo?: string;
  oauthError?: boolean;
  recoveryError?: boolean;
}

type SignInApiResponse = {
  success: boolean;
  message?: string;
  redirect?: string;
  requireCaptcha?: boolean;
};

export function SignInForm({ redirectTo, oauthError, recoveryError }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
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

  const onCaptchaToken = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          captchaToken: captchaToken ?? undefined,
          redirectTo,
        }),
      });

      const data = (await res.json()) as SignInApiResponse;

      if (data.requireCaptcha) {
        setRequireCaptcha(true);
        setCaptchaToken(null);
      }

      if (!res.ok || !data.success) {
        setError(data.message ?? "E-mail ou senha inválidos.");
        setLoading(false);
        return;
      }

      router.refresh();
      router.replace(data.redirect ?? "/dashboard");
    } catch {
      setError("Não foi possível entrar agora. Tente novamente em instantes.");
      setLoading(false);
    }
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

        {requireCaptcha && (
          <div className="pt-1">
            <RecaptchaV2 onToken={onCaptchaToken} />
          </div>
        )}

        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          className="pt-1"
        >
          <Button
            type="submit"
            disabled={loading || (requireCaptcha && !captchaToken && Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY))}
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
