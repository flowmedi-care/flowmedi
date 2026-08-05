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
        O {company} (&quot;FlowMed&quot;, &quot;nós&quot;) é uma plataforma SaaS de gestão para
        clínicas médicas. Esta Política de Privacidade descreve como tratamos dados pessoais no site
        institucional, nas contas de usuários da plataforma e nos dados processados em nome das
        clínicas clientes, em conformidade com a Lei nº 13.709/2018 (LGPD).
      </p>

      <LegalH2>1. Veracidade das informações</LegalH2>
      <p>
        O titular é responsável pela veracidade dos dados informados. Dados incorretos podem
        prejudicar o atendimento e o exercício de direitos. A clínica controladora e o FlowMed podem
        solicitar confirmação ou correção quando necessário.
      </p>

      <LegalH2>2. Definições</LegalH2>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong className="text-foreground">Dados pessoais:</strong> informação relacionada a
          pessoa natural identificada ou identificável (art. 5º, I).
        </li>
        <li>
          <strong className="text-foreground">Dados sensíveis:</strong> dados sobre saúde, entre
          outros listados no art. 5º, II — comuns em formulários e prontuário.
        </li>
        <li>
          <strong className="text-foreground">Controlador:</strong> quem decide sobre o tratamento
          (em regra, a clínica para dados de pacientes).
        </li>
        <li>
          <strong className="text-foreground">Operador:</strong> quem trata em nome do controlador
          (FlowMed, para dados de pacientes conforme instruções da clínica).
        </li>
        <li>
          <strong className="text-foreground">Titular:</strong> pessoa a quem se referem os dados.
        </li>
      </ul>

      <LegalH2>3. Papéis na LGPD</LegalH2>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong className="text-foreground">Clínica usuária:</strong> controladora dos dados de
          pacientes e da equipe clínica no contexto do atendimento.
        </li>
        <li>
          <strong className="text-foreground">FlowMed:</strong> operador em relação aos dados de
          pacientes; controlador em relação a cadastro da clínica, cobrança, suporte e visitantes do
          site.
        </li>
      </ul>

      <LegalH2>4. Inventário por finalidade</LegalH2>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong className="text-foreground">Conta e cobrança:</strong> nome, e-mail, telefone,
          dados de faturamento — prestação do serviço contratado.
        </li>
        <li>
          <strong className="text-foreground">Gestão clínica:</strong> dados de pacientes, agenda,
          prontuário, exames, comunicações — conforme instrução da clínica.
        </li>
        <li>
          <strong className="text-foreground">Comunicações:</strong> e-mail e WhatsApp transacionais
          e, quando habilitado, marketing com consentimento.
        </li>
        <li>
          <strong className="text-foreground">Segurança:</strong> logs de acesso, auditoria,
          confirmação de e-mail e proteção anti-abuso no login.
        </li>
        <li>
          <strong className="text-foreground">Site institucional:</strong> cookies de sessão e dados
          técnicos de navegação.
        </li>
      </ul>

      <LegalH2>5. Bases legais</LegalH2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Prestação do serviço contratado (art. 7º, V).</li>
        <li>Comunicações transacionais de agenda e formulários (art. 7º, V ou VII).</li>
        <li>Marketing: consentimento (art. 7º, I), com opt-in quando aplicável.</li>
        <li>
          Dados sensíveis de saúde: tutela da saúde por profissionais (art. 11, II, f) e/ou
          consentimento específico (art. 11, I), conforme instrução do controlador.
        </li>
        <li>Segurança e prevenção a fraudes (art. 7º, IX — legítimo interesse).</li>
        <li>Cumprimento de obrigações legais (art. 7º, II).</li>
      </ul>

      <LegalH2>6. Compartilhamento e subprocessadores</LegalH2>
      <p>
        Compartilhamos dados com prestadores estritamente necessários, listados em{" "}
        <LegalLink href="/subprocessadores">Subprocessadores</LegalLink>. Alterações relevantes são
        comunicadas conforme o{" "}
        <LegalLink href="/acordo-tratamento-dados">DPA</LegalLink>. Não vendemos dados pessoais.
      </p>

      <LegalH2>7. Transferência internacional (arts. 33–36)</LegalH2>
      <p>
        Alguns subprocessadores (hospedagem, mensageria, IA) podem processar dados fora do Brasil.
        Adotamos cláusulas contratuais e medidas compatíveis com a LGPD. Detalhes no DPA e na lista
        de subprocessadores.
      </p>

      <LegalH2>8. Decisões automatizadas e IA (art. 20)</LegalH2>
      <p>
        O assistente virtual via WhatsApp (quando habilitado) utiliza modelos de linguagem de
        terceiros. Enviamos contexto mínimo necessário. O titular pode digitar DESATIVE para
        desligar a IA. Aviso de privacidade pode ser enviado na primeira interação automatizada.
        Reclamações são encaminhadas a atendimento humano.
      </p>

      <LegalH2>9. Segurança (arts. 46–49)</LegalH2>
      <p>
        HTTPS, autenticação, isolamento por clínica (RLS), perfis de acesso, armazenamento privado
        para arquivos sensíveis, auditoria, confirmação de e-mail e proteções anti-abuso no login
        (rate limit e CAPTCHA). Recomendamos senhas fortes e revisão periódica de acessos.
      </p>

      <LegalH2>10. Retenção (arts. 15–16)</LegalH2>
      <p>
        Dados de conta: vigência do contrato mais até 3 anos para obrigações legais e disputas,
        salvo prazo maior exigido por lei. Dados de prontuário médico: prazos definidos pelo
        controlador e legislação de saúde (ex.: CFM Res. 1.821/2007 — guarda mínima de 20 anos para
        prontuário em suporte físico; prontuário eletrônico permanente). Logs operacionais: política
        interna de retenção (padrão 24 meses para logs de mensagens e IA, configurável).
      </p>

      <LegalH2>11. Direitos do titular (art. 18)</LegalH2>
      <p>
        Acesso, confirmação, correção, anonimização, portabilidade, eliminação, informação sobre
        compartilhamento e oposição, nos termos da lei.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong className="text-foreground">Pacientes:</strong> contatar a clínica controladora ou
          usar o{" "}
          <LegalLink href="/privacidade-titular">Portal de Direitos do Titular</LegalLink>.
        </li>
        <li>
          <strong className="text-foreground">Prazos (art. 18 §1):</strong> confirmação/acesso
          simples em até 5 dias úteis; demais pedidos em até 15 dias úteis.
        </li>
        <li>
          <strong className="text-foreground">Contas FlowMed:</strong>{" "}
          <LegalLink href="/exclusao-de-dados">Exclusão de Dados</LegalLink>, painel da clínica
          (solicitações de privacidade) ou e-mail do Encarregado.
        </li>
      </ul>

      <LegalH2>12. Marketing</LegalH2>
      <p>
        Comunicações promocionais dependem de consentimento específico quando exigido, com opção de
        revogação a qualquer momento. Mensagens transacionais de saúde não substituem consentimento
        de marketing.
      </p>

      <LegalH2>13. Cookies</LegalH2>
      <p>
        Utilizamos cookies essenciais de sessão e, no painel autenticado, cookies/localStorage
        de analytics de produto (PostHog) para entender uso e melhorar o serviço — sem
        publicidade e sem gravação de sessões. Detalhes em{" "}
        <LegalLink href="/politica-de-cookies">Política de Cookies</LegalLink>.
      </p>

      <LegalH2>14. Encarregado de dados (art. 41)</LegalH2>
      <p>
        {dpo.name ? `${dpo.name} — ` : ""}
        <a href={`mailto:${dpo.email}`} className="text-primary underline-offset-2 hover:underline">
          {dpo.email}
        </a>
        . Página: <LegalLink href="/encarregado-dados">Encarregado de Dados</LegalLink>.
      </p>

      <LegalH2>15. Alterações (art. 8º §6)</LegalH2>
      <p>
        Podemos atualizar esta política. A versão vigente consta no topo desta página. Alterações
        relevantes serão comunicadas por e-mail ou aviso no painel, com antecedência razoável quando
        a mudança exigir nova base legal ou consentimento.
      </p>
    </LegalPageShell>
  );
}
