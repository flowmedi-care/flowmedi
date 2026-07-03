import { cn } from "@/lib/utils";

interface PublicSectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  id?: string;
}

export function PublicSectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className,
  id,
}: PublicSectionHeaderProps) {
  return (
    <div
      id={id}
      className={cn(
        "mx-auto max-w-3xl",
        align === "center" && "text-center",
        className
      )}
    >
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          "font-bold tracking-tight text-foreground",
          eyebrow ? "mt-3" : "",
          "text-3xl sm:text-4xl"
        )}
      >
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
