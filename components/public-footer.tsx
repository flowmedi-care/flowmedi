import Link from "next/link";
import { FlowmediLogo } from "@/components/flowmedi-logo";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <FlowmediLogo href="/" showText={true} size="sm" />
            <p className="max-w-xs text-sm text-muted-foreground">
              Agenda, formulários e comunicação para sua clínica. Simples e em conformidade com a LGPD.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 md:flex md:gap-12">
            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">
                Produto
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/precos"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Preços
                  </Link>
                </li>
                <li>
                  <Link
                    href="/criar-conta"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Começar grátis
                  </Link>
                </li>
                <li>
                  <Link
                    href="/entrar"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Entrar
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">
                Legal
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/politica-de-privacidade"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Política de Privacidade
                  </Link>
                </li>
                <li>
                  <Link
                    href="/termos-de-servico"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Termos de Serviço
                  </Link>
                </li>
                <li>
                  <Link
                    href="/exclusao-de-dados"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Exclusão de dados
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-border pt-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} FlowMedi. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
