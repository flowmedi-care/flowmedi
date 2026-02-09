import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirect = typeof params.redirect === "string" ? params.redirect : undefined;

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
            <h1 className="text-2xl font-semibold text-foreground">Entrar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesse o dashboard da sua clínica
            </p>
          </div>
          <LoginForm redirectTo={redirect} />
          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link href={redirect ? `/criar-conta?redirect=${encodeURIComponent(redirect)}` : "/criar-conta"} className="text-primary hover:underline">
              Criar conta
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/esqueci-senha"
              className="text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
