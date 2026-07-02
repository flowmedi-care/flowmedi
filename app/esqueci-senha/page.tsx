import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-form";
import { AuthLayout } from "@/components/auth-layout";

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const linkInvalid = params.error === "link_invalido";

  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail e enviaremos um link para redefinir"
    >
      {linkInvalid && (
        <p className="mb-4 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          O link de redefinição é inválido ou expirou. Solicite um novo abaixo.
        </p>
      )}
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/entrar" className="text-primary hover:underline">
          Voltar para entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
