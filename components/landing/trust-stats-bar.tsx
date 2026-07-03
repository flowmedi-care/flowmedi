import { TRUST_ITEMS } from "@/lib/landing/content";
import { cn } from "@/lib/utils";

interface TrustStatsBarProps {
  className?: string;
  variant?: "default" | "compact";
}

export function TrustStatsBar({ className, variant = "default" }: TrustStatsBarProps) {
  return (
    <section
      className={cn(
        "border-y border-border bg-muted/30",
        variant === "compact" ? "py-6" : "py-10 md:py-12",
        className
      )}
      aria-label="Diferenciais da plataforma"
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8 max-w-5xl mx-auto">
          {TRUST_ITEMS.map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-sm font-bold text-foreground sm:text-base">
                {item.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
