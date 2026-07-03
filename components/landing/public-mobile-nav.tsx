"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { PUBLIC_NAV_LINKS } from "@/lib/landing/content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PublicMobileNavProps {
  className?: string;
}

export function PublicMobileNav({ className }: PublicMobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("md:hidden", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div className="absolute left-0 right-0 top-16 z-50 border-b border-border bg-background/95 backdrop-blur-xl shadow-lg">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {PUBLIC_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
              <Link href="/entrar" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full">
                  Entrar
                </Button>
              </Link>
              <Link href="/criar-conta" onClick={() => setOpen(false)}>
                <Button className="w-full">Começar grátis</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
