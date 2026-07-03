import Link from "next/link";
import { Server, ShieldCheck, FileCheck, UserCheck } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { PublicSectionHeader } from "@/components/landing/public-section-header";
import { SecurityTrustSection } from "@/components/landing/security-trust-section";
import { CtaBand } from "@/components/landing/cta-band";
import { Button } from "@/components/ui/button";
import { getCompanyLegalName, getDpoContact } from "@/lib/compliance/config";

export const metadata = {
  title: "Segurança e LGPD — FlowMed",
  description:
    "Saiba como o FlowMed protege os dados da sua clínica com isolamento por conta, conformidade LGPD e documentação legal completa.",
};

const SECURITY_HIGHLIGHTS = [
  {
    icon: Server,
    title: "100% na nuvem",
    description:
      "Acesse os dados da clínica, da equipe e dos pacientes diretamente no navegador, sem downloads ou instalações complicadas.",
  },
  {
    icon: ShieldCheck,
    title: "Proteção de dados",
    description:
      "Criptografia em trânsito (HTTPS/TLS), isolamento lógico por clínica e controles de acesso por perfil de usuário.",
  },
  {
    icon: FileCheck,
    title: "Documentação legal",
    description:
      "Política de privacidade, termos de serviço, acordo de tratamento (DPA), política de cookies e lista de subprocessadores.",
  },
  {
    icon: UserCheck,
    title: "Direitos do titular",
    description:
      "Canal estruturado para solicitações de titulares de dados, com fluxo de atendimento e registro de consentimento.",
  },
];

export default function SegurancaPage() {
  const dpo = getDpoContact();
  const company = getCompanyLegalName();

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 gradient-mesh opacity-100" />
          <div className="container relative mx-auto px-4 py-16 md:py-24">
            <PublicSectionHeader
              eyebrow="Segurança"
              title="Mais segurança e tranquilidade para o seu negócio"
              description={`O ${company} foi projetado com privacidade desde o início, em conformidade com a LGPD e com documentação transparente para sua clínica.`}
            />
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-2">
              {SECURITY_HIGHLIGHTS.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="surface-elevated p-8 transition-all hover:border-primary/30 hover:shadow-elevated-lg"
                  >
                    <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-3 text-muted-foreground leading-relaxed">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <SecurityTrustSection />

        <section className="py-16 md:py-20 border-t border-border">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl surface-elevated rounded-2xl border border-border p-8 md:p-12 text-center shadow-elevated-lg">
              <h2 className="text-2xl font-bold text-foreground">Documentação e canais</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Acesse nossa documentação legal completa ou entre em contato com o Encarregado de Dados.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/politica-de-privacidade">
                  <Button variant="outline">Política de Privacidade</Button>
                </Link>
                <Link href="/privacidade-titular">
                  <Button variant="outline">Direitos do titular</Button>
                </Link>
                <Link href="/subprocessadores">
                  <Button variant="outline">Subprocessadores</Button>
                </Link>
              </div>
              <p className="mt-8 text-sm text-muted-foreground">
                Encarregado de Dados:{" "}
                <a href={`mailto:${dpo.email}`} className="text-primary hover:underline">
                  {dpo.email}
                </a>
              </p>
            </div>
          </div>
        </section>

        <CtaBand
          title="Comece com segurança desde o primeiro dia"
          description="Crie sua conta e tenha acesso a todas as ferramentas de conformidade LGPD."
        />
      </main>

      <PublicFooter />
    </div>
  );
}
