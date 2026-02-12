import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade — FlowMedi",
};

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg">
            FlowMedi
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/precos" className="hover:text-foreground">
              Preços
            </Link>
            <Link href="/entrar" className="hover:text-foreground">
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-10 md:py-16 max-w-3xl">
          <h1 className="text-3xl font-bold mb-6">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              O FlowMedi é uma plataforma de gestão de agenda, formulários clínicos e
              comunicação entre clínicas médicas e seus pacientes. Esta Política de
              Privacidade descreve como tratamos os dados pessoais dentro do sistema.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              1. Dados coletados
            </h2>
            <p>
              A plataforma pode armazenar dados como nome, e-mail, telefone, data de
              nascimento, histórico de consultas, formulários clínicos e preferências
              de comunicação dos pacientes, bem como dados de usuários da clínica
              (administradores, médicos e secretárias).
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              2. Finalidade do tratamento
            </h2>
            <p>
              Os dados são utilizados exclusivamente para fins de agendamento de
              consultas, envio de formulários, registro de consentimento, envio de
              confirmações e lembretes (e-mail e WhatsApp) e para cumprir obrigações
              legais relacionadas à prestação de serviços de saúde pela clínica.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              3. Compartilhamento de dados
            </h2>
            <p>
              Os dados são acessíveis apenas aos profissionais e colaboradores da
              clínica autorizados pelo administrador e a provedores de serviço
              estritamente necessários para o funcionamento da plataforma
              (por exemplo, provedores de infraestrutura, e-mail e WhatsApp).
              Não vendemos dados pessoais a terceiros.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              4. Segurança
            </h2>
            <p>
              Empregamos boas práticas de segurança para proteger os dados, incluindo
              uso de conexões criptografadas (HTTPS) e controles de acesso baseados em
              autenticação e perfis de usuário.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              5. Direitos do titular de dados
            </h2>
            <p>
              O paciente pode solicitar acesso, correção ou exclusão de seus dados
              pessoais entrando em contato diretamente com a clínica usuária do
              FlowMedi. A clínica é a controladora dos dados e nós atuamos como
              operadores de tratamento.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              6. Contato para questões de privacidade
            </h2>
            <p>
              Para dúvidas sobre esta política, entre em contato com a clínica que
              lhe atende ou com o suporte do FlowMedi pelo canal informado na
              própria aplicação.
            </p>

            <p>
              Para saber como solicitar a exclusão de dados associados ao uso de
              aplicativos de terceiros (como Meta / WhatsApp), consulte também a
              página{" "}
              <Link
                href="/exclusao-de-dados"
                className="text-primary underline-offset-2 hover:underline"
              >
                Exclusão de Dados
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

