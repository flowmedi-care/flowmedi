import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ContactCard({
  name,
  subtitle,
  detail,
  avatarSrc,
  badges,
  onClick,
  className,
}: {
  name: string;
  subtitle?: string | null;
  detail?: string | null;
  avatarSrc?: string | null;
  badges?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all",
        onClick && "cursor-pointer hover:border-primary/30 hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} src={avatarSrc} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight truncate">{name}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {detail && (
        <p className="text-xs text-muted-foreground line-clamp-2">{detail}</p>
      )}
      {badges && <div className="flex flex-wrap gap-1">{badges}</div>}
    </Comp>
  );
}

export function ContactCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ContactCardSection({
  letter,
  children,
  sectionRef,
}: {
  letter: string;
  children: React.ReactNode;
  sectionRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={sectionRef} data-letter={letter} className="space-y-3">
      <p className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-1 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {letter}
      </p>
      {children}
    </div>
  );
}

export function ContactCardBadge({
  children,
  variant = "secondary",
}: {
  children: React.ReactNode;
  variant?: "secondary" | "outline";
}) {
  return (
    <Badge variant={variant} className="text-[10px] font-normal">
      {children}
    </Badge>
  );
}
