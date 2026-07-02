import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RecuperarClient } from "./recuperar-client";

export default function AuthRecuperarPage() {
  return (
    <AuthShell
      title="Redefinir senha"
      subtitle="Confirme o link recebido por e-mail para continuar"
    >
      <Suspense
        fallback={<p className="text-sm text-muted-foreground text-center">Carregando…</p>}
      >
        <RecuperarClient />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/entrar" className="text-primary hover:underline">
          Voltar para entrar
        </Link>
      </p>
    </AuthShell>
  );
}
