import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FlowmediLogo } from "@/components/flowmedi-logo";

interface PublicHeaderProps {
  variant?: "default" | "minimal";
}

export function PublicHeader({ variant = "default" }: PublicHeaderProps) {
  if (variant === "minimal") {
    return (
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <FlowmediLogo size="sm" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <FlowmediLogo size="sm" />
        <nav className="flex items-center gap-1 sm:gap-4">
          <Link
            href="/precos"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Preços
          </Link>
          <Link href="/entrar">
            <Button variant="ghost" size="sm">
              Entrar
            </Button>
          </Link>
          <Link href="/criar-conta">
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Começar grátis
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
