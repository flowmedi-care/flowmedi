import Link from "next/link";
import { LoginForm } from "./login-form";
import { AuthLayout } from "@/components/auth-layout";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirect = typeof params.redirect === "string" ? params.redirect : undefined;

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse o dashboard da sua clínica"
    >
      <LoginForm redirectTo={redirect} />
      <div className="mt-6 space-y-3 text-center text-sm">
        <p className="text-muted-foreground">
          Não tem conta?{" "}
          <Link
            href={redirect ? `/criar-conta?redirect=${encodeURIComponent(redirect)}` : "/criar-conta"}
            className="font-medium text-primary hover:underline"
          >
            Criar conta
          </Link>
        </p>
        <p>
          <Link
            href="/esqueci-senha"
            className="text-muted-foreground hover:text-primary hover:underline"
          >
            Esqueci minha senha
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
