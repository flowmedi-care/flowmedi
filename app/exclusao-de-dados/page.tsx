import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export const metadata = {
  title: "Exclusão de Dados — FlowMedi",
};

export default function ExclusaoDadosPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="flex-1">
        <section className="container mx-auto px-4 py-10 md:py-16 max-w-3xl">
          <h1 className="text-3xl font-bold mb-6">Exclusão de Dados</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              Esta página explica como um titular de dados pode solicitar a exclusão
              de informações pessoais associadas ao uso do FlowMedi, incluindo
              integrações com terceiros como Meta / WhatsApp.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              1. Dados armazenados
            </h2>
            <p>
              O FlowMedi armazena dados de pacientes e usuários para fins de agenda,
              formulários clínicos, consentimento LGPD e comunicação. Esses dados
              pertencem à clínica que utiliza o sistema e são tratados conforme nossa{" "}
              <Link
                href="/politica-de-privacidade"
                className="text-primary underline-offset-2 hover:underline"
              >
                Política de Privacidade
              </Link>
              .
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              2. Como solicitar exclusão de dados
            </h2>
            <p>
              Para solicitar a exclusão de seus dados pessoais, o paciente deve
              entrar em contato diretamente com a clínica responsável pelo seu
              atendimento (controladora dos dados), utilizando os canais de contato
              informados pela própria clínica (telefone, WhatsApp ou e-mail).
            </p>
            <p>
              Após a solicitação, a clínica poderá excluir ou anonimizar os dados
              dentro do FlowMedi, respeitando obrigações legais de guarda de
              prontuário e registros médicos.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              3. Integrações com terceiros (por exemplo, Meta / WhatsApp)
            </h2>
            <p>
              Caso você tenha autorizado o uso de seu número de telefone para
              recebimento de mensagens via WhatsApp ou outros canais, a exclusão de
              dados no FlowMedi não impede que existam registros técnicos mínimos
              mantidos pelos provedores de comunicação (como Meta Platforms, Inc.)
              conforme as políticas deles.
            </p>
            <p>
              Para exercer seus direitos de privacidade diretamente junto à Meta,
              consulte as páginas oficiais de privacidade do Facebook/WhatsApp.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              4. Suporte
            </h2>
            <p>
              Se você é responsável por uma clínica e precisa de suporte para
              atender a pedidos de exclusão de dados feitos por pacientes, entre em
              contato com o suporte do FlowMedi pelos canais indicados na aplicação.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

