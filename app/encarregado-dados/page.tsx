import { LegalH2, LegalLink, LegalPageShell } from "@/components/legal-page-shell";
import { getCompanyLegalName, getDpoContact, getPrivacyPolicyVersion } from "@/lib/compliance/config";

export const metadata = {
  title: "Encarregado de Dados — FlowMed",
};

export default function EncarregadoDadosPage() {
  const dpo = getDpoContact();
  const company = getCompanyLegalName();

  return (
    <LegalPageShell title="Encarregado de Dados (DPO)" lastUpdated={getPrivacyPolicyVersion()}>
      <p>
        Em conformidade com o art. 41 da Lei nº 13.709/2018 (LGPD), o {company} indica o canal
        abaixo para questões relacionadas ao tratamento de dados pessoais no âmbito da plataforma
        FlowMed (contas de clínicas, site institucional e operação do software).
      </p>

      <LegalH2>1. Papel do Encarregado</LegalH2>
      <p>
        O Encarregado atua como canal de comunicação entre o {company}, os titulares de dados e a
        Autoridade Nacional de Proteção de Dados (ANPD), orientando sobre práticas de privacidade e
        recebendo solicitações relacionadas aos dados tratados pelo FlowMed na qualidade de operador
        ou controlador, conforme o caso.
      </p>

      <LegalH2>2. Dados de pacientes das clínicas</LegalH2>
      <p>
        Para dados de pacientes tratados em nome de uma clínica usuária, a clínica é a{" "}
        <strong className="text-foreground">controladora</strong>. O titular deve, em regra,
        contatar primeiro a clínica que realiza o atendimento. O Encarregado do FlowMed pode
        auxiliar na mediação quando a solicitação envolver sistemas operados por nós.
      </p>

      <LegalH2>3. Contato e ANPD</LegalH2>
      <ul className="list-disc pl-5 space-y-1">
        {dpo.name && (
          <li>
            <span className="text-foreground">Nome:</span> {dpo.name}
          </li>
        )}
        <li>
          <span className="text-foreground">E-mail:</span>{" "}
          <a href={`mailto:${dpo.email}`} className="text-primary underline-offset-2 hover:underline">
            {dpo.email}
          </a>
        </li>
        <li>
          <span className="text-foreground">ANPD:</span>{" "}
          <a
            href="https://www.gov.br/anpd"
            className="text-primary underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.gov.br/anpd
          </a>
        </li>
      </ul>
      <p>
        Consulte também a{" "}
        <LegalLink href="/politica-de-privacidade">Política de Privacidade</LegalLink>, o{" "}
        <LegalLink href="/privacidade-titular">Portal de Direitos do Titular</LegalLink>, a página de{" "}
        <LegalLink href="/exclusao-de-dados">Exclusão de Dados</LegalLink> e o{" "}
        <LegalLink href="/acordo-tratamento-dados">Acordo de Tratamento de Dados</LegalLink>.
      </p>
    </LegalPageShell>
  );
}
