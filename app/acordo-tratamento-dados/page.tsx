import { LegalH2, LegalLink, LegalPageShell } from "@/components/legal-page-shell";
import { getCompanyLegalName, getDpoContact, getPrivacyPolicyVersion } from "@/lib/compliance/config";

export const metadata = {
  title: "Acordo de Tratamento de Dados (DPA) — FlowMed",
};

export default function AcordoTratamentoDadosPage() {
  const company = getCompanyLegalName();
  const dpo = getDpoContact();

  return (
    <LegalPageShell
      title="Acordo de Tratamento de Dados (DPA)"
      lastUpdated={getPrivacyPolicyVersion()}
    >
      <p>
        Este documento descreve as condições em que o {company} (&quot;Operador&quot;) trata dados
        pessoais em nome das clínicas usuárias (&quot;Controladoras&quot;) da plataforma FlowMed,
        nos termos do art. 39 da Lei nº 13.709/2018 (LGPD).
      </p>
      <p>
        <strong className="text-foreground">Nota:</strong> versão modelo para transparência. A
        contratação comercial pode exigir assinatura individualizada. Em caso de conflito, prevalece
        o contrato assinado entre as partes.
      </p>

      <LegalH2>1. Objeto e duração</LegalH2>
      <p>
        O Operador processará dados pessoais exclusivamente para prestar os serviços contratados
        (agenda, formulários, comunicações, prontuário operacional, integrações habilitadas),
        durante a vigência da assinatura e pelo prazo necessário após o término para backup legal e
        transição.
      </p>

      <LegalH2>2. Instruções do controlador</LegalH2>
      <p>
        O tratamento limita-se às instruções documentadas do Controlador (configurações na
        plataforma, habilitação de integrações, templates de mensagem e uso dos módulos). O
        Operador notificará o Controlador se uma instrução violar a LGPD.
      </p>

      <LegalH2>3. Confidencialidade e segurança</LegalH2>
      <p>
        O Operador implementa medidas técnicas e administrativas proporcionais ao risco (art. 46),
        incluindo autenticação, isolamento por clínica (RLS), controle de acesso por perfil,
        criptografia em trânsito (HTTPS) e armazenamento privado para arquivos sensíveis, conforme
        documentação técnica.
      </p>

      <LegalH2>4. Subprocessadores</LegalH2>
      <p>
        O Controlador autoriza o uso dos subprocessadores listados em{" "}
        <LegalLink href="/subprocessadores">Subprocessadores</LegalLink>, sujeito a aviso prévio de
        alterações materiais. Cada subprocessador deve estar vinculado a obrigações equivalentes de
        proteção de dados.
      </p>

      <LegalH2>5. Transferência internacional</LegalH2>
      <p>
        Quando dados forem transferidos para outros países (ex.: hospedagem, IA, mensageria), o
        Operador adotará mecanismos previstos nos arts. 33 a 36 da LGPD e informará o Controlador
        na documentação de privacidade.
      </p>

      <LegalH2>6. Direitos dos titulares</LegalH2>
      <p>
        O Operador auxiliará o Controlador a atender solicitações de titulares (art. 18), incluindo
        ferramentas de exportação, exclusão e registro de solicitações no painel administrativo,
        dentro de prazos razoáveis após instrução do Controlador.
      </p>

      <LegalH2>7. Incidentes de segurança</LegalH2>
      <p>
        O Operador comunicará ao Controlador, sem demora injustificada, incidentes de segurança que
        possam acarretar risco ou dano relevante aos titulares, com informações para cumprimento do
        art. 48 da LGPD pelo Controlador, quando aplicável.
      </p>

      <LegalH2>8. Eliminação e devolução</LegalH2>
      <p>
        Ao término do contrato, o Operador eliminará ou devolverá os dados pessoais conforme
        instrução do Controlador, ressalvadas obrigações legais de guarda (ex.: prontuário médico
        sob responsabilidade do Controlador).
      </p>

      <LegalH2>9. Auditoria</LegalH2>
      <p>
        O Controlador pode solicitar informações razoáveis sobre conformidade. Logs de auditoria de
        ações na plataforma podem estar disponíveis conforme o plano contratado.
      </p>

      <LegalH2>10. Contato</LegalH2>
      <p>
        Encarregado de dados do Operador:{" "}
        <a href={`mailto:${dpo.email}`} className="text-primary underline-offset-2 hover:underline">
          {dpo.email}
        </a>
        . Veja também os{" "}
        <LegalLink href="/termos-de-servico">Termos de Serviço</LegalLink> e a{" "}
        <LegalLink href="/politica-de-privacidade">Política de Privacidade</LegalLink>.
      </p>
    </LegalPageShell>
  );
}
