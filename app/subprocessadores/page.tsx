import { LegalH2, LegalLink, LegalPageShell } from "@/components/legal-page-shell";
import { getPrivacyPolicyVersion } from "@/lib/compliance/config";

export const metadata = {
  title: "Subprocessadores — FlowMed",
};

const SUBPROCESSORS = [
  {
    name: "Supabase Inc.",
    purpose: "Autenticação, banco de dados PostgreSQL e armazenamento de arquivos",
    data: "Dados de clínicas, pacientes, mensagens, arquivos clínicos e operacionais",
    location: "Conforme região do projeto (validar no painel Supabase)",
  },
  {
    name: "Vercel Inc.",
    purpose: "Hospedagem da aplicação web e processamento de requisições",
    data: "Logs técnicos, metadados de requisições, variáveis de ambiente em runtime",
    location: "Estados Unidos / global",
  },
  {
    name: "Stripe, Inc.",
    purpose: "Cobrança de assinaturas das clínicas",
    data: "Dados de faturamento da clínica (não dados clínicos de pacientes)",
    location: "Estados Unidos / internacional",
  },
  {
    name: "Meta Platforms, Inc.",
    purpose: "WhatsApp Business API (mensagens configuradas pela clínica)",
    data: "Telefone, nome de contato, conteúdo de mensagens e mídia",
    location: "Estados Unidos / internacional",
  },
  {
    name: "Google LLC",
    purpose: "Login OAuth (opcional) e envio de e-mail via Gmail API por clínica",
    data: "E-mail de usuários; conteúdo de e-mails enviados pela clínica",
    location: "Estados Unidos / internacional",
  },
  {
    name: "OpenAI, L.L.C.",
    purpose:
      "Assistente virtual via WhatsApp e transcrição de áudios recebidos no WhatsApp (quando habilitado pelo plano/clínica)",
    data: "Mensagens da conversa, áudios de voz do paciente transcritos e contexto mínimo para agendamento (sem dados clínicos sensíveis intencionais)",
    location: "Estados Unidos",
  },
  {
    name: "ViaProve (ou provedor configurado)",
    purpose: "Transcrição de áudio de consultas (quando utilizado)",
    data: "Áudio e texto transcrito",
    location: "Conforme contrato do provedor (validar operacionalmente)",
  },
  {
    name: "PostHog, Inc.",
    purpose:
      "Analytics de produto (páginas visitadas, eventos de ativação/retenção no painel)",
    data: "IDs de usuário e clínica, papel (role), URLs do painel e eventos de produto — sem dados clínicos de pacientes",
    location: "Estados Unidos (PostHog Cloud US) ou União Europeia (se configurado EU)",
  },
] as const;

export default function SubprocessadoresPage() {
  return (
    <LegalPageShell title="Subprocessadores" lastUpdated={getPrivacyPolicyVersion()}>
      <p>
        O FlowMed utiliza prestadores de serviço que tratam dados pessoais em nosso nome ou em nome
        das clínicas usuárias, na qualidade de operadores ou suboperadores, conforme o art. 5º, VII
        e art. 39 da LGPD.
      </p>
      <p>
        <strong className="text-foreground">Lacuna operacional:</strong> a existência de acordos de
        tratamento (DPA) assinados com cada fornecedor deve ser validada pela equipe jurídica/comercial.
        Esta página reflete o inventário técnico observado no código.
      </p>

      <LegalH2>Inventário</LegalH2>
      <div className="space-y-4">
        {SUBPROCESSORS.map((sp) => (
          <div key={sp.name} className="rounded-lg border border-border p-4 space-y-1">
            <p className="font-semibold text-foreground">{sp.name}</p>
            <p>
              <span className="text-foreground">Finalidade:</span> {sp.purpose}
            </p>
            <p>
              <span className="text-foreground">Dados tratados:</span> {sp.data}
            </p>
            <p>
              <span className="text-foreground">Localização:</span> {sp.location}
            </p>
          </div>
        ))}
      </div>

      <LegalH2>Transferência internacional</LegalH2>
      <p>
        Alguns subprocessadores podem tratar dados fora do Brasil. Nesses casos, aplicam-se os arts.
        33 a 36 da LGPD (mecanismos de transferência, cláusulas contratuais padrão ou decisões de
        adequação, conforme aplicável). Detalhes contratuais estão no{" "}
        <LegalLink href="/acordo-tratamento-dados">Acordo de Tratamento de Dados</LegalLink>.
      </p>

      <LegalH2>Atualizações</LegalH2>
      <p>
        Alterações relevantes nesta lista serão comunicadas às clínicas conforme o acordo de
        tratamento e a <LegalLink href="/politica-de-privacidade">Política de Privacidade</LegalLink>.
      </p>
    </LegalPageShell>
  );
}
