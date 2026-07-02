import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { InteractiveHeroShowcase } from "@/components/landing/interactive-hero-showcase";
import {
  Calendar,
  FileText,
  MessageSquare,
  Shield,
  LayoutDashboard,
  CheckCircle2,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <InteractiveHeroShowcase />

        {/* Features */}
        <section className="border-t border-border bg-muted/20 py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Tudo que sua clínica precisa
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Fluxo completo: da agenda ao paciente, com segurança e controles de acesso.
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
                <h3 className="font-semibold text-foreground">Privacidade</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Registro de consentimento, isolamento de dados por clínica e
                  canal para solicitações de titulares.
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
