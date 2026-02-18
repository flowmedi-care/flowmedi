import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import {
  Calendar,
  FileText,
  MessageSquare,
  Shield,
  LayoutDashboard,
  ArrowRight,
  Zap,
  CheckCircle2,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="gradient-mesh relative overflow-hidden">
          <div className="container mx-auto px-4 pt-20 pb-24 md:pt-28 md:pb-36">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
                <Zap className="h-4 w-4" />
                <span>Comece grátis — sem cartão de crédito</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                Agenda, formulários e{" "}
                <span className="text-primary">comunicação</span> para sua clínica
              </h1>
              <p className="mt-6 text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto leading-relaxed">
                Centralize a agenda por médico, envie formulários clínicos ao paciente
                e mantenha tudo organizado com confirmações e LGPD em dia.
              </p>
              <div className="mt-10 flex flex-wrap gap-4 justify-center">
                <Link href="/criar-conta">
                  <Button size="lg" className="text-base h-12 px-8 shadow-lg shadow-primary/25">
                    Criar conta gratuita
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/precos">
                  <Button size="lg" variant="outline" className="text-base h-12 px-8">
                    Ver planos
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                Plano Starter gratuito • 1 médico • Até 50 consultas/mês
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-muted/20 py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Tudo que sua clínica precisa
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Fluxo completo: da agenda ao paciente, com segurança e conformidade.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
              <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Agenda central</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Agenda por médico, visualização diária, semanal e mensal.
                  Status: agendada, confirmada, realizada, falta.
                </p>
              </div>
              <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Formulários clínicos</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Construtor de formulários personalizados vinculados a tipos de
                  consulta. Respostas no painel do médico.
                </p>
              </div>
              <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Comunicação</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Envio de link do formulário e lembretes. WhatsApp e e-mail
                  transacionais no plano Profissional.
                </p>
              </div>
              <div className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">LGPD</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Consentimento do paciente registrado. Bloqueio de envio sem
                  aceite explícito.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works / Roles */}
        <section className="py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-sm md:p-12">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Simples para toda a equipe
              </h2>
              <p className="mt-4 text-muted-foreground">
                Cada perfil com o que precisa: Admin configura, Secretária agenda e envia,
                Médico acompanha agenda e dados do paciente.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Admin</span>
                  <span className="text-sm text-muted-foreground">— Clínica e plano</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Secretária</span>
                  <span className="text-sm text-muted-foreground">— Agenda e formulários</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Médico</span>
                  <span className="text-sm text-muted-foreground">— Agenda e paciente</span>
                </div>
              </div>
              <Link href="/entrar" className="mt-8 inline-flex">
                <Button size="lg" variant="secondary">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Acessar o dashboard
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-primary/5 py-20 md:py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Pronto para simplificar sua clínica?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              Comece em minutos. Sem fidelidade, cancele quando quiser.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <Link href="/criar-conta">
                <Button size="lg" className="h-12 px-8 text-base">
                  Começar grátis
                </Button>
              </Link>
              <Link href="/precos">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                  Ver planos e preços
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
