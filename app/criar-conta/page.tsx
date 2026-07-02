import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default async function CriarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; email?: string }>;
}) {
  const params = await searchParams;
  const redirect = typeof params.redirect === "string" ? params.redirect : undefined;
  const prefilledEmail = typeof params.email === "string" ? params.email : undefined;

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Comece a usar o FlowMed na sua clínica"
    >
      <SignUpForm redirectTo={redirect} prefilledEmail={prefilledEmail} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href={
            redirect
              ? `/entrar?redirect=${encodeURIComponent(redirect)}`
              : "/entrar"
          }
          className="font-medium text-primary hover:underline"
        >
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
