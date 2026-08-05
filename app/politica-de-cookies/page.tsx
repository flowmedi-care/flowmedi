import { LegalH2, LegalLink, LegalPageShell } from "@/components/legal-page-shell";
import { getPrivacyPolicyVersion } from "@/lib/compliance/config";

export const metadata = {
  title: "Política de Cookies — FlowMed",
};

export default function PoliticaCookiesPage() {
  return (
    <LegalPageShell title="Política de Cookies" lastUpdated={getPrivacyPolicyVersion()}>
      <p>
        Esta política descreve como o site e a aplicação FlowMed utilizam cookies e tecnologias
        semelhantes.
      </p>

      <LegalH2>1. O que são cookies</LegalH2>
      <p>
        Cookies são pequenos arquivos armazenados no seu navegador que permitem funcionalidades
        essenciais, como manter sua sessão autenticada de forma segura.
      </p>

      <LegalH2>2. Cookies que utilizamos</LegalH2>
      <table className="w-full text-left border border-border rounded-lg overflow-hidden">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-foreground font-medium">Categoria</th>
            <th className="p-3 text-foreground font-medium">Finalidade</th>
            <th className="p-3 text-foreground font-medium">Base</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <td className="p-3">Estritamente necessários</td>
            <td className="p-3">Autenticação Supabase (sessão HTTP-only), segurança</td>
            <td className="p-3">Legítimo interesse / execução de contrato</td>
          </tr>
          <tr className="border-t border-border">
            <td className="p-3">Analytics de produto</td>
            <td className="p-3">
              PostHog: medir uso do painel (páginas visitadas, ativação, retenção). Sem
              gravação de tela. Não enviamos dados clínicos de pacientes.
            </td>
            <td className="p-3">Legítimo interesse (melhoria do produto B2B)</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-4">
        Analytics de produto usa cookies/localStorage do PostHog apenas quando a chave de
        projeto está configurada. Você pode bloquear cookies de terceiros no navegador; o
        painel continua funcionando (sessão Supabase é independente).
      </p>

      <LegalH2>3. Como gerenciar cookies</LegalH2>
      <p>
        Você pode bloquear ou excluir cookies nas configurações do navegador. Cookies essenciais de
        sessão são necessários para usar o painel da clínica após o login.
      </p>

      <LegalH2>4. Mais informações</LegalH2>
      <p>
        Veja a <LegalLink href="/politica-de-privacidade">Política de Privacidade</LegalLink> e o
        contato do <LegalLink href="/encarregado-dados">Encarregado de Dados</LegalLink>.
      </p>
    </LegalPageShell>
  );
}
