import { LegalH2, LegalLink, LegalPageShell } from "@/components/legal-page-shell";
import { getCompanyLegalName, getDpoContact, getPrivacyPolicyVersion } from "@/lib/compliance/config";

export const metadata = {
  title: "Política de Privacidade — FlowMed",
};

export default function PoliticaPrivacidadePage() {
  const company = getCompanyLegalName();
  const dpo = getDpoContact();

  return (
    <LegalPageShell title="Política de Privacidade" lastUpdated={getPrivacyPolicyVersion()}>
      <p>
        O {company} (&quot;FlowMed&quot;) é uma plataforma de gestão para clínicas médicas. Esta
        Política de Privacidade descreve como tratamos dados pessoais no site institucional, nas
        contas de usuários da plataforma e nos dados processados em nome das clínicas clientes.
      </p>

      <LegalH2>1. Papéis na LGPD</LegalH2>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong className="text-foreground">Clínica usuária:</strong> controladora dos dados de
          pacientes e da equipe clínica tratados no contexto do atendimento.
        </li>
        <li>
          <strong className="text-foreground">FlowMed:</strong> operador em relação aos dados de
          pacientes tratados conforme instruções da clínica; controlador em relação a dados de
          cadastro da clínica, cobrança, suporte e visitantes do site.
        </li>
      </ul>

      <LegalH2>2. Dados coletados</LegalH2>
      <p>
        Conforme o uso da plataforma: identificação e contato (nome, e-mail, telefone, CPF quando
        informado), dados de saúde inseridos em formulários e prontuário, histórico de consultas,
        comunicações (e-mail/WhatsApp), arquivos clínicos, registros de consentimento, logs de
        auditoria e dados técnicos de acesso.
      </p>

      <LegalH2>3. Finalidades e bases legais</LegalH2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Prestação do serviço contratado (art. 7º, V — execução de contrato).</li>
        <li>Comunicações transacionais de agenda e formulários (art. 7º, V ou VII).</li>
        <li>Comunicações de marketing, quando habilitadas: consentimento (art. 7º, I) ou outra base definida pela clínica.</li>
        <li>Dados sensíveis de saúde: tratamento pela clínica para tutela da saúde (art. 11, II, f) e/ou consentimento específico (art. 11, I), conforme instrução do controlador.</li>
        <li>Segurança, prevenção a fraudes e logs (art. 7º, IX — legítimo interesse, com avaliação de impacto).</li>
        <li>Cumprimento de obrigações legais (art. 7º, II).</li>
      </ul>

      <LegalH2>4. Compartilhamento e subprocessadores</LegalH2>
      <p>
        Compartilhamos dados com prestadores estritamente necessários ao funcionamento do serviço,
        listados em <LegalLink href="/subprocessadores">Subprocessadores</LegalLink>. Não vendemos
        dados pessoais.
      </p>

      <LegalH2>5. Transferência internacional</LegalH2>
      <p>
        Alguns subprocessadores podem processar dados fora do Brasil (ex.: hospedagem, mensageria,
        IA). Adotamos cláusulas e medidas compatíveis com os arts. 33 a 36 da LGPD. Detalhes no{" "}
        <LegalLink href="/acordo-tratamento-dados">Acordo de Tratamento de Dados (DPA)</LegalLink>.
      </p>

      <LegalH2>6. Uso de inteligência artificial</LegalH2>
      <p>
        O assistente virtual via WhatsApp (quando habilitado) utiliza modelos de linguagem de
        terceiros para interpretar mensagens e auxiliar em agendamentos. Enviamos apenas o contexto
        mínimo necessário. O titular pode digitar DESATIVE para desligar a IA na conversa. Mensagens
        podem incluir aviso de privacidade na primeira interação automatizada.
      </p>

      <LegalH2>7. Segurança</LegalH2>
      <p>
        Empregamos HTTPS, autenticação, isolamento de dados por clínica, perfis de acesso,
        armazenamento privado para arquivos sensíveis e registros de auditoria. Recomendamos
        autenticação em dois fatores (MFA) para usuários da clínica.
      </p>

      <LegalH2>8. Retenção</LegalH2>
      <p>
        Mantemos dados enquanto a conta estiver ativa e pelo tempo necessário para obrigações
        legais, resolução de disputas e backup. Dados de prontuário médico seguem prazos definidos
        pelo controlador e legislação aplicável à saúde.
      </p>

      <LegalH2>9. Direitos do titular (art. 18)</LegalH2>
      <p>
        Pacientes devem contatar a clínica controladora. Clínicas e titulares de contas FlowMed
        podem solicitar acesso, correção, exclusão, portabilidade e informações sobre
        compartilhamento via{" "}
        <LegalLink href="/exclusao-de-dados">Exclusão de Dados</LegalLink>, painel da clínica
        (solicitações de privacidade) ou e-mail do Encarregado.
      </p>

      <LegalH2>10. Cookies</LegalH2>
      <p>
        Utilizamos cookies essenciais de sessão. Detalhes em{" "}
        <LegalLink href="/politica-de-cookies">Política de Cookies</LegalLink>.
      </p>

      <LegalH2>11. Encarregado de dados</LegalH2>
      <p>
        Contato:{" "}
        <a href={`mailto:${dpo.email}`} className="text-primary underline-offset-2 hover:underline">
          {dpo.email}
        </a>
        . Página dedicada: <LegalLink href="/encarregado-dados">Encarregado de Dados</LegalLink>.
      </p>

      <LegalH2>12. Alterações</LegalH2>
      <p>
        Podemos atualizar esta política. A data da versão vigente aparece no topo desta página.
        Alterações relevantes serão comunicadas por canais apropriados.
      </p>
    </LegalPageShell>
  );
}
