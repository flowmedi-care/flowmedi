import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CtaBandProps {
  title?: string;
  description?: string;
  className?: string;
  variant?: "default" | "primary";
}

export function CtaBand({
  title = "Pronto para simplificar sua clínica?",
  description = "Comece em minutos. Sem fidelidade, cancele quando quiser.",
  className,
  variant = "default",
}: CtaBandProps) {
  const isPrimary = variant === "primary";

  return (
    <section
      className={cn(
        "py-16 md:py-20",
        isPrimary ? "bg-primary text-primary-foreground" : "border-t border-border bg-primary/5",
        className
      )}
    >
      <div className="container mx-auto px-4 text-center">
        <h2
          className={cn(
            "text-3xl font-bold tracking-tight sm:text-4xl",
            isPrimary ? "text-primary-foreground" : "text-foreground"
          )}
        >
          {title}
        </h2>
        <p
          className={cn(
            "mt-4 text-lg max-w-xl mx-auto",
            isPrimary ? "text-primary-foreground/85" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link href="/criar-conta">
            <Button
              size="lg"
              className={cn(
                "h-12 px-8 text-base",
                isPrimary && "bg-white text-primary hover:bg-white/90"
              )}
            >
              Começar grátis
            </Button>
          </Link>
          <Link href="/precos">
            <Button
              size="lg"
              variant="outline"
              className={cn(
                "h-12 px-8 text-base",
                isPrimary && "border-white/80 text-white hover:bg-white/10 bg-transparent"
              )}
            >
              Ver planos e preços
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
