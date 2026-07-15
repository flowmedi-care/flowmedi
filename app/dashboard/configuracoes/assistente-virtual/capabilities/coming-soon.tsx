"use client";

export type ComingSoonItem = {
  id: string;
  label: string;
};

/** Single placeholder pattern for future capability controls. */
export function ComingSoon({
  title = "Em breve",
  items,
}: {
  title?: string;
  items: ComingSoonItem[];
}) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border/80 bg-muted/30 p-4 opacity-70">
      <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <label
              className="flex cursor-not-allowed items-center gap-2 text-sm text-muted-foreground"
              title="Disponível em breve"
            >
              <input type="checkbox" disabled checked={false} className="opacity-50" />
              {item.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
