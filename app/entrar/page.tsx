import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string; error_code?: string }>;
}) {
  const params = await searchParams;
  const redirect = typeof params.redirect === "string" ? params.redirect : undefined;
  const oauthError = params.error === "oauth";
  const recoveryError =
    params.error === "recovery" || params.error_code === "otp_expired";

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Acesse o dashboard da sua clínica"
    >
      <SignInForm
        redirectTo={redirect}
        oauthError={oauthError}
        recoveryError={recoveryError}
      />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link
          href={
            redirect
              ? `/criar-conta?redirect=${encodeURIComponent(redirect)}`
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
