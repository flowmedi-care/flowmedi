import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader />
      <main className="flex-1">
        <section className="relative border-b border-border">
          <div className="absolute inset-0 gradient-mesh opacity-60" />
          <div className="container relative mx-auto px-4 py-10 md:py-14 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">
              Legal
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {title}
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Última atualização: {lastUpdated}
            </p>
          </div>
        </section>
        <section className="container mx-auto px-4 py-10 md:py-16 max-w-3xl">
          <div className="surface-elevated rounded-2xl border border-border p-6 md:p-10 space-y-6 text-sm leading-relaxed text-muted-foreground shadow-elevated">
            {children}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

export function LegalH2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-foreground pt-2">{children}</h2>;
}

export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-primary underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
