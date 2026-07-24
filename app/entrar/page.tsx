import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { createClient } from "@/lib/supabase/server";
import {
  resolvePostAuthRedirect,
  sanitizeRedirectPath,
} from "@/lib/auth/post-auth-redirect";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect?: string;
    error?: string;
    error_code?: string;
    code?: string;
    reset?: string;
  }>;
}) {
  const params = await searchParams;
  const redirectTo = typeof params.redirect === "string" ? params.redirect : undefined;

  if (typeof params.code === "string" && params.code.length > 0) {
    const next = params.reset === "1" ? "/redefinir-senha" : "/dashboard";
    redirect(
      `/auth/callback?code=${encodeURIComponent(params.code)}&next=${encodeURIComponent(next)}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const path = await resolvePostAuthRedirect(
      supabase,
      user.id,
      sanitizeRedirectPath(redirectTo)
    );
    redirect(path);
  }

  const oauthError = params.error === "oauth";
  const recoveryError =
    params.error === "recovery" ||
    params.error === "access_denied" ||
    params.error_code === "otp_expired";

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Acesse o dashboard da sua clínica"
    >
      <SignInForm
        redirectTo={redirectTo}
        oauthError={oauthError}
        recoveryError={recoveryError}
      />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link
          href={
            redirectTo
              ? `/criar-conta?redirect=${encodeURIComponent(redirectTo)}`
              : "/criar-conta"
          }
          className="font-medium text-primary hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </AuthShell>
  );
}
