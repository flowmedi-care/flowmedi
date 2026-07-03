import Link from "next/link";
import { Mail, MessageSquare } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { PublicSectionHeader } from "@/components/landing/public-section-header";
import { CONTACT_EMAIL } from "@/lib/landing/content";
import { getDpoContact } from "@/lib/compliance/config";
import { Accordion, AccordionItem } from "@/components/ui/accordion";

export const metadata = {
  title: "Contato — FlowMed",
  description: "Entre em contato com a equipe FlowMed para dúvidas sobre a plataforma, privacidade ou suporte.",
};

const CONTACT_FAQ = [
  {
    id: "support",
    question: "Como obter suporte técnico?",
    answer:
      "Usuários cadastrados podem acessar o suporte pelo painel da clínica. Para questões gerais, envie um e-mail para privacidade@flowmed.app.",
  },
  {
    id: "privacy",
    question: "Tenho uma solicitação LGPD. Para quem devo enviar?",
    answer:
      "Para dados de pacientes, contate primeiro a clínica responsável pelo atendimento. Para questões sobre a plataforma FlowMed, use o canal do Encarregado de Dados.",
  },
  {
    id: "demo",
    question: "Posso testar antes de contratar?",
    answer:
      "Sim. Crie uma conta gratuita em /criar-conta e explore a plataforma sem necessidade de cartão de crédito.",
  },
];

export default function ContatoPage() {
  const dpo = getDpoContact();

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 gradient-mesh opacity-100" />
          <div className="container relative mx-auto px-4 py-16 md:py-24">
            <PublicSectionHeader
              eyebrow="Contato"
              title="Fale com a gente"
              description="Dúvidas sobre a plataforma, privacidade ou parcerias? Estamos à disposição."
            />
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl grid gap-8 md:grid-cols-2">
              <article className="surface-elevated rounded-2xl border border-border p-8 shadow-elevated-lg">
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">E-mail geral</h2>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  Para dúvidas sobre a plataforma, parcerias ou informações gerais.
                </p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="mt-6 inline-block text-primary font-semibold hover:underline underline-offset-2"
                >
                  {CONTACT_EMAIL}
                </a>
              </article>

              <article className="surface-elevated rounded-2xl border border-border p-8 shadow-elevated-lg">
                <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Encarregado de Dados</h2>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  Para questões relacionadas à privacidade e tratamento de dados na plataforma.
                </p>
                <a
                  href={`mailto:${dpo.email}`}
                  className="mt-6 inline-block text-primary font-semibold hover:underline underline-offset-2"
                >
                  {dpo.email}
                </a>
                <p className="mt-4 text-sm text-muted-foreground">
                  <Link href="/encarregado-dados" className="text-primary hover:underline">
                    Saiba mais sobre o Encarregado →
                  </Link>
                </p>
              </article>
            </div>

            <div className="mx-auto max-w-2xl mt-16">
              <h2 className="text-2xl font-bold text-center text-foreground mb-8">
                Perguntas frequentes
              </h2>
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-elevated">
                <Accordion defaultOpenId={CONTACT_FAQ[0].id}>
                  {CONTACT_FAQ.map((item) => (
                    <AccordionItem
                      key={item.id}
                      id={item.id}
                      question={item.question}
                      answer={item.answer}
                    />
                  ))}
                </Accordion>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
