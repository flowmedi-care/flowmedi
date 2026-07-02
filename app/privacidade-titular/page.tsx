import { LegalH2, LegalLink, LegalPageShell } from "@/components/legal-page-shell";
import { getDpoContact } from "@/lib/compliance/config";
import { PrivacidadeTitularForm } from "./privacidade-titular-form";

export const metadata = {
  title: "Direitos do Titular — FlowMed",
};

export default function PrivacidadeTitularPage() {
  const dpo = getDpoContact();

  return (
    <LegalPageShell title="Portal de Direitos do Titular" lastUpdated="2026-07-02">
      <p>
        Este canal permite que pacientes e titulares de dados exercitem direitos previstos no art.
        18 da LGPD junto à <strong className="text-foreground">clínica controladora</strong> dos
        seus dados de saúde. O FlowMed opera a plataforma em nome da clínica e encaminha a
        solicitação ao painel da clínica.
      </p>

      <LegalH2>1. Prazos (LGPD art. 18 §1)</LegalH2>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong className="text-foreground">Confirmação de existência ou acesso simples:</strong>{" "}
          até 5 dias úteis.
        </li>
        <li>
          <strong className="text-foreground">
            Demais pedidos (correção, eliminação, portabilidade):
          </strong>{" "}
          até 15 dias úteis, salvo prorrogação justificada.
        </li>
      </ul>

      <LegalH2>2. Eliminação e prontuário médico</LegalH2>
      <p>
        Dados de prontuário podem ser mantidos pelo prazo legal (CFM Res. 1.821/2007). Quando a
        exclusão total não for possível, a clínica poderá{" "}
        <strong className="text-foreground">bloquear ou anonimizar</strong> identificadores,
        preservando o mínimo necessário à guarda legal.
      </p>

      <LegalH2>3. Enviar solicitação</LegalH2>
      <PrivacidadeTitularForm />

      <LegalH2>4. Outros canais</LegalH2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Contato direto com a clínica onde você é atendido(a).</li>
        <li>
          Encarregado FlowMed (dados da plataforma):{" "}
          <a href={`mailto:${dpo.email}`} className="text-primary underline-offset-2 hover:underline">
            {dpo.email}
          </a>
        </li>
        <li>
          <LegalLink href="/exclusao-de-dados">Exclusão de dados — contas FlowMed</LegalLink>
        </li>
      </ul>
    </LegalPageShell>
  );
}
