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
            <td className="p-3">Analytics de produto e marketing</td>
            <td className="p-3">
              PostHog: medir uso do site e do painel (páginas visitadas, eventos de engajamento,
              ativação e retenção). Em páginas públicas de marketing (por exemplo, a landing de
              clínicas), podemos gravar sessões (session replay) para entender a experiência de
              navegação — sem publicidade comportamental. No painel clínico autenticado, a
              gravação de sessão permanece desligada; não enviamos dados clínicos de pacientes de
              forma intencional.
            </td>
            <td className="p-3">Legítimo interesse (melhoria do produto e do site B2B)</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-4">
        Analytics usa cookies/localStorage do PostHog apenas quando a chave de projeto está
        configurada. Você pode bloquear cookies de terceiros no navegador; o painel continua
        funcionando (sessão Supabase é independente).
      </p>

      <LegalH2>3. Session replay (gravação de sessão)</LegalH2>
      <p>
        Quando ativo, o session replay registra interações na interface (cliques, rolagem e
        elementos da página) nas rotas públicas de marketing. Campos de formulário podem ser
        mascarados. Essa funcionalidade <strong>não</strong> é utilizada no painel da clínica
        (áreas autenticadas com dados de pacientes).
      </p>

      <LegalH2>4. Como gerenciar cookies</LegalH2>
      <p>
        Você pode bloquear ou excluir cookies nas configurações do navegador. Cookies essenciais de
        sessão são necessários para usar o painel da clínica após o login.
      </p>

      <LegalH2>5. Mais informações</LegalH2>
      <p>
        Veja a <LegalLink href="/politica-de-privacidade">Política de Privacidade</LegalLink> e o
        contato do <LegalLink href="/encarregado-dados">Encarregado de Dados</LegalLink>.
      </p>
    </LegalPageShell>
  );
}
