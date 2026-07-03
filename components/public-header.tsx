import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FlowmediLogo } from "@/components/flowmedi-logo";
import { PublicMobileNav } from "@/components/landing/public-mobile-nav";
import { PUBLIC_NAV_LINKS } from "@/lib/landing/content";

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
      <div className="container relative mx-auto flex h-16 items-center justify-between px-4">
        <FlowmediLogo size="sm" />
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {PUBLIC_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/entrar" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Entrar
            </Button>
          </Link>
          <Link href="/criar-conta" className="hidden sm:block">
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Começar grátis
            </Button>
          </Link>
          <PublicMobileNav />
        </div>
      </div>
    </header>
  );
}
