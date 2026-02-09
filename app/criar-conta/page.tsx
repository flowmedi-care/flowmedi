import Link from "next/link";
import { SignUpForm } from "./signup-form";

export default function CriarContaPage() {
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
              Criar conta
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Comece a usar o FlowMedi na sua clínica
            </p>
          </div>
          <SignUpForm />
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/entrar" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
