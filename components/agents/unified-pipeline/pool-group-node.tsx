"use client";

export type PoolGroupNodeData = {
  label: string;
  width: number;
  height: number;
};

export function PoolGroupNode({ data }: { data: PoolGroupNodeData }) {
  return (
    <div
      className="pointer-events-none rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/[0.03]"
      style={{ width: data.width, height: data.height }}
    >
      <span className="absolute -top-2.5 left-3 rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        {data.label}
      </span>
    </div>
  );
}
