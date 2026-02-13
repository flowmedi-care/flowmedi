import Link from "next/link";

export const metadata = {
  title: "Termos de Serviço — FlowMedi",
};

export default function TermosServicoPage() {
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
          <h1 className="text-3xl font-bold mb-6">Termos de Serviço</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              Estes Termos de Serviço regem o uso da plataforma FlowMedi. Ao acessar ou
              utilizar nossos serviços, você concorda em cumprir e estar vinculado a
              estes termos.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              1. Aceitação dos Termos
            </h2>
            <p>
              Ao criar uma conta, acessar ou usar o FlowMedi, você confirma que leu,
              compreendeu e concorda em estar vinculado a estes Termos de Serviço e a
              nossa Política de Privacidade. Se você não concordar com algum destes
              termos, não deve usar nossos serviços.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              2. Descrição do Serviço
            </h2>
            <p>
              O FlowMedi é uma plataforma de gestão para clínicas médicas que oferece
              funcionalidades de agendamento, formulários clínicos, comunicação com
              pacientes e gestão de dados conforme a LGPD. Os serviços são fornecidos
              mediante assinatura de planos conforme disponibilidade.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              3. Conta de Usuário
            </h2>
            <p>
              Você é responsável por manter a confidencialidade de suas credenciais de
              acesso e por todas as atividades que ocorram em sua conta. Você concorda
              em notificar-nos imediatamente sobre qualquer uso não autorizado de sua
              conta ou qualquer outra violação de segurança.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              4. Uso Aceitável
            </h2>
            <p>
              Você concorda em usar o FlowMedi apenas para fins legais e de acordo com
              estes termos. É proibido usar a plataforma para atividades ilegais,
              fraudulentas ou que violem direitos de terceiros. Você não deve tentar
              acessar áreas restritas, interferir no funcionamento do sistema ou
              realizar engenharia reversa do software.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              5. Responsabilidades da Clínica
            </h2>
            <p>
              A clínica é responsável pelo tratamento adequado dos dados dos pacientes
              conforme a LGPD e demais legislações aplicáveis. A clínica deve obter os
              consentimentos necessários dos pacientes antes de coletar e processar seus
              dados pessoais. O FlowMedi atua como operador de tratamento de dados.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              6. Planos e Pagamento
            </h2>
            <p>
              Os serviços são oferecidos mediante assinatura de planos conforme
              disponibilidade. Os valores, funcionalidades e condições de cada plano
              estão disponíveis na página de preços. O pagamento é processado conforme
              o método escolhido e os termos de cobrança podem ser alterados mediante
              aviso prévio.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              7. Disponibilidade do Serviço
            </h2>
            <p>
              Nos esforçamos para manter o FlowMedi disponível, mas não garantimos
              disponibilidade ininterrupta. Podemos realizar manutenções programadas ou
              de emergência que podem resultar em indisponibilidade temporária. Não nos
              responsabilizamos por perdas decorrentes de indisponibilidade do serviço.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              8. Propriedade Intelectual
            </h2>
            <p>
              Todo o conteúdo, design, código e funcionalidades do FlowMedi são de
              propriedade do FlowMedi ou de seus licenciadores e estão protegidos por
              leis de propriedade intelectual. Você não pode copiar, modificar,
              distribuir ou criar trabalhos derivados sem autorização expressa.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              9. Limitação de Responsabilidade
            </h2>
            <p>
              O FlowMedi é fornecido "como está", sem garantias expressas ou implícitas.
              Não nos responsabilizamos por danos diretos, indiretos, incidentais ou
              consequenciais decorrentes do uso ou impossibilidade de uso do serviço.
              Nossa responsabilidade total está limitada ao valor pago nos últimos 12
              meses pelo serviço.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              10. Rescisão
            </h2>
            <p>
              Você pode cancelar sua conta a qualquer momento através das configurações
              da plataforma. Reservamo-nos o direito de suspender ou encerrar contas que
              violem estes termos ou que sejam usadas de forma inadequada. Em caso de
              rescisão, os dados podem ser mantidos conforme necessário para cumprimento
              de obrigações legais.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              11. Alterações nos Termos
            </h2>
            <p>
              Podemos modificar estes Termos de Serviço a qualquer momento. Alterações
              significativas serão comunicadas aos usuários. O uso continuado do serviço
              após as alterações constitui aceitação dos novos termos.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              12. Lei Aplicável
            </h2>
            <p>
              Estes termos são regidos pelas leis brasileiras. Qualquer disputa será
              resolvida nos tribunais competentes do Brasil.
            </p>

            <h2 className="text-lg font-semibold text-foreground">
              13. Contato
            </h2>
            <p>
              Para questões sobre estes Termos de Serviço, entre em contato através dos
              canais de suporte disponíveis na plataforma FlowMedi.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
