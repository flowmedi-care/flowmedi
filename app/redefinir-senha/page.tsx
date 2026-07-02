import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/esqueci-senha?error=link_invalido");
  }

  return (
    <AuthShell
      title="Nova senha"
      subtitle="Escolha uma senha segura para sua conta FlowMed"
    >
      <ResetPasswordForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/entrar" className="text-primary hover:underline">
          Voltar para entrar
        </Link>
      </p>
    </AuthShell>
  );
}
