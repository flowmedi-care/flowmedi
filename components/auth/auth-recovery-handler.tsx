"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Recupera sessão de redefinição de senha quando o Supabase redireciona com ?code=
 * ou com tokens no hash (fluxo legado). Também trata erros no hash.
 */
export function AuthRecoveryHandler({
  onRecoveryError,
}: {
  onRecoveryError?: (message: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = searchParams.get("code");
      if (code) {
        const next = searchParams.get("reset") === "1" ? "/redefinir-senha" : "/dashboard";
        window.location.replace(
          `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`
        );
        return;
      }

      if (typeof window === "undefined" || !window.location.hash) return;

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError = hash.get("error_code") ?? hash.get("error");
      if (hashError === "otp_expired" || hash.get("error") === "access_denied") {
        onRecoveryError?.(
          "O link de redefinição expirou ou já foi usado. Solicite um novo link em Esqueci minha senha."
        );
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type = hash.get("type");

      if (accessToken && refreshToken && type === "recovery") {
        const supabase = createClient();
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (error) {
          onRecoveryError?.(error.message);
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
        router.replace("/redefinir-senha");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router, onRecoveryError]);

  return null;
}
