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
          <div className="container mx-auto px-4 pt-20 pb-16 md:pt-28 md:pb-20">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary shadow-sm">
                <Zap className="h-4 w-4" />
                <span>Comece grátis — sem cartão de crédito</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                Agenda, formulários e{" "}
                <span className="text-primary">comunicação</span> para sua clínica
              </h1>
              <p className="mt-6 text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto leading-relaxed">
                Centralize a agenda por profissional, envie formulários clínicos ao paciente
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
                Plano Starter gratuito • 1 profissional • Até 50 consultas/mês
              </p>
            </div>

            {/* Dashboard preview mockup */}
            <div className="mx-auto mt-16 max-w-5xl">
              <div className="surface-elevated overflow-hidden rounded-2xl shadow-elevated-lg border-border/60">
                <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  </div>
                  <span className="ml-2 text-xs text-muted-foreground">FlowMed Dashboard</span>
                </div>
                <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4 bg-muted/20">
                  {[
                    { label: "Consultas hoje", value: "24", trend: "+12%" },
                    { label: "Taxa comparecimento", value: "94%", trend: "+3%" },
                    { label: "Receita do mês", value: "R$ 48k", trend: "+8%" },
                    { label: "Pacientes ativos", value: "312", trend: "+5%" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                      <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums">{stat.value}</p>
                      <p className="mt-1 text-xs font-medium text-success-muted-foreground">{stat.trend} vs mês anterior</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border/60 bg-card p-6">
                  <div className="h-32 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-end px-4 pb-4">
                    <div className="flex items-end gap-2 h-20">
                      {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                        <div
                          key={i}
                          className="w-6 rounded-t-md bg-primary/30"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
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
              <div className="group surface-elevated p-6 transition-all hover:border-primary/30 hover:shadow-elevated-lg">
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Agenda central</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Agenda por profissional, visualização diária, semanal e mensal.
                  Status: agendada, confirmada, realizada, falta.
                </p>
              </div>
              <div className="group surface-elevated p-6 transition-all hover:border-primary/30 hover:shadow-elevated-lg">
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Formulários clínicos</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Construtor de formulários personalizados vinculados a tipos de
                  consulta. Respostas no painel do profissional.
                </p>
              </div>
              <div className="group surface-elevated p-6 transition-all hover:border-primary/30 hover:shadow-elevated-lg">
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Comunicação</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Envio de link do formulário e lembretes. WhatsApp e e-mail
                  transacionais no plano Profissional.
                </p>
              </div>
              <div className="group surface-elevated p-6 transition-all hover:border-primary/30 hover:shadow-elevated-lg">
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
            <div className="mx-auto max-w-3xl surface-elevated p-8 md:p-12 shadow-elevated-lg">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Simples para toda a equipe
              </h2>
              <p className="mt-4 text-muted-foreground">
                Cada perfil com o que precisa: Admin configura, Secretário(a) agenda e envia,
                Profissional acompanha agenda e dados do paciente.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Admin</span>
                  <span className="text-sm text-muted-foreground">— Clínica e plano</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Secretário(a)</span>
                  <span className="text-sm text-muted-foreground">— Agenda e formulários</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Profissional</span>
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
