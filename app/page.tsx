import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  FileText,
  MessageSquare,
  Shield,
  LayoutDashboard,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg text-foreground">
            FlowMedi
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/precos"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Preços
            </Link>
            <Link href="/entrar">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/criar-conta">
              <Button>Começar grátis</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground max-w-3xl mx-auto">
            Agenda, formulários e comunicação para sua clínica
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Centralize a agenda por médico, envie formulários clínicos ao paciente
            e mantenha tudo organizado com confirmações e LGPD em dia.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link href="/criar-conta">
              <Button size="lg" className="text-base">
                Criar conta gratuita
              </Button>
            </Link>
            <Link href="/precos">
              <Button size="lg" variant="outline" className="text-base">
                Ver planos
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t border-border bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-semibold text-center mb-12">
              O que o FlowMedi faz por você
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium text-foreground">Agenda central</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Agenda por médico, visualização diária, semanal e mensal.
                  Status: agendada, confirmada, realizada, falta.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium text-foreground">Formulários clínicos</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Construtor de formulários personalizados vinculados a tipos de
                  consulta. Respostas no painel do médico.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium text-foreground">Comunicação</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Envio de link do formulário e lembretes. WhatsApp e e-mail
                  transacionais (em breve).
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium text-foreground">LGPD</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Consentimento do paciente registrado. Bloqueio de envio sem
                  aceite.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4 text-center">
            <p className="text-muted-foreground mb-6">
              Papéis: Admin configura a clínica e o plano. Secretária agenda e
              envia formulários. Médico vê agenda e dados do paciente.
            </p>
            <Link href="/entrar">
              <Button variant="secondary" size="lg">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Acessar o dashboard
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">FlowMedi</span>
          <div className="flex flex-wrap gap-6">
            <Link
              href="/precos"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Preços
            </Link>
            <Link
              href="/entrar"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Entrar
            </Link>
            <Link
              href="/criar-conta"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Criar conta
            </Link>
            <Link
              href="/politica-de-privacidade"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Política de Privacidade
            </Link>
            <Link
              href="/termos-de-servico"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Termos de Serviço
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
