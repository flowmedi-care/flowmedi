"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SignUpFormProps {
  redirectTo?: string;
  prefilledEmail?: string;
}

export function SignUpForm({ redirectTo, prefilledEmail }: SignUpFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(prefilledEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const finalRedirect =
    redirectTo && redirectTo.startsWith("/")
      ? `${origin}${redirectTo}`
      : `${origin}/dashboard`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As duas senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (!acceptedTerms) {
      setError("Você precisa aceitar os Termos de Serviço e a Política de Privacidade.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: finalRedirect,
      },
    });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    router.refresh();
    router.push(
      redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard"
    );
  }

  return (
    <div className="space-y-6">
      <GoogleSignInButton
        redirectTo={redirectTo}
        label="Criar conta com Google"
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-card text-muted-foreground">ou</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Seu nome"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            className="bg-muted/30"
          />
        </div>

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
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="bg-muted/30"
          />
          <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Digite a senha novamente"
            className="bg-muted/30"
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 rounded border-border"
          />
          <span>
            Li e aceito os{" "}
            <Link href="/termos-de-servico" className="text-primary underline-offset-2 hover:underline" target="_blank">
              Termos de Serviço
            </Link>{" "}
            e a{" "}
            <Link href="/politica-de-privacidade" className="text-primary underline-offset-2 hover:underline" target="_blank">
              Política de Privacidade
            </Link>
            .
          </span>
        </label>

        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          className="pt-1"
        >
          <Button
            type="submit"
            disabled={loading || !acceptedTerms}
            className={cn(
              "w-full h-10 relative overflow-hidden",
              isHovered && "shadow-lg shadow-primary/20"
            )}
          >
            <span className="flex items-center justify-center">
              {loading ? "Criando…" : "Criar conta"}
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
      </form>
    </div>
  );
}
