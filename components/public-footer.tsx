import Link from "next/link";
import { FlowmediLogo } from "@/components/flowmedi-logo";
import { CONTACT_EMAIL } from "@/lib/landing/content";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4 lg:col-span-1">
            <FlowmediLogo href="/" showText={true} size="sm" />
            <p className="max-w-xs text-sm text-muted-foreground">
              Agenda, formulários e comunicação para sua clínica. Recursos que auxiliam a gestão de dados pessoais.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Produto</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/recursos" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Recursos
                </Link>
              </li>
              <li>
                <Link href="/precos" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Preços
                </Link>
              </li>
              <li>
                <Link href="/seguranca" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Segurança
                </Link>
              </li>
              <li>
                <Link href="/criar-conta" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Começar grátis
                </Link>
              </li>
              <li>
                <Link href="/entrar" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Entrar
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Recursos</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/sugestoes" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Sugestões
                </Link>
              </li>
              <li>
                <Link href="/contato" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Contato
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/politica-de-privacidade" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link href="/termos-de-servico" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Termos de Serviço
                </Link>
              </li>
              <li>
                <Link href="/exclusao-de-dados" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Exclusão de dados
                </Link>
              </li>
              <li>
                <Link href="/privacidade-titular" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Direitos do titular
                </Link>
              </li>
              <li>
                <Link href="/encarregado-dados" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Encarregado de dados
                </Link>
              </li>
              <li>
                <Link href="/acordo-tratamento-dados" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Acordo de tratamento (DPA)
                </Link>
              </li>
              <li>
                <Link href="/politica-de-cookies" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Política de cookies
                </Link>
              </li>
              <li>
                <Link href="/subprocessadores" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Subprocessadores
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} FlowMed. Todos os direitos reservados.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
