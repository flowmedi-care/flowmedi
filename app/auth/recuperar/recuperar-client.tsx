"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function RecuperarClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "recovery";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!tokenHash) {
      setError("Link inválido. Solicite um novo e-mail de redefinição.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "recovery",
    });

    setLoading(false);

    if (err) {
      const msg = err.message.toLowerCase();
      if (msg.includes("expired") || msg.includes("invalid")) {
        setError("Este link expirou ou já foi usado. Solicite um novo em Esqueci minha senha.");
      } else {
        setError(err.message);
      }
      return;
    }

    router.refresh();
    router.push("/redefinir-senha");
  }

  if (!tokenHash) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          Link inválido ou incompleto.
        </p>
        <Link href="/esqueci-senha" className="text-sm text-primary hover:underline">
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">
        Clique no botão abaixo para validar o link e escolher uma nova senha.
      </p>
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>
      )}
      <Button type="button" className="w-full" disabled={loading} onClick={handleContinue}>
        {loading ? "Validando…" : "Continuar para nova senha"}
      </Button>
      <Link href="/esqueci-senha" className="text-sm text-primary hover:underline">
        Solicitar novo link
      </Link>
    </div>
  );
}
