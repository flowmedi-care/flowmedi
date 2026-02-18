import Link from "next/link";
import { SignUpForm } from "./signup-form";
import { AuthLayout } from "@/components/auth-layout";

export default async function CriarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirect = typeof params.redirect === "string" ? params.redirect : undefined;

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Comece a usar o FlowMedi na sua clínica"
    >
      <SignUpForm redirectTo={redirect} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href={redirect ? `/entrar?redirect=${encodeURIComponent(redirect)}` : "/entrar"}
          className="font-medium text-primary hover:underline"
        >
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
