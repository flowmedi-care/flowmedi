import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-form";

export default function EsqueciSenhaPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center">
          <Link href="/" className="font-semibold text-foreground">
            FlowMedi
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              Esqueci minha senha
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe seu e-mail e enviaremos um link para redefinir
            </p>
          </div>
          <ForgotPasswordForm />
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/entrar" className="text-primary hover:underline">
              Voltar para entrar
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
