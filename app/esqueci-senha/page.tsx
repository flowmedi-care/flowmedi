import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-form";
import { AuthLayout } from "@/components/auth-layout";

export default function EsqueciSenhaPage() {
  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail e enviaremos um link para redefinir"
    >
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/entrar" className="text-primary hover:underline">
          Voltar para entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
