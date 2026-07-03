"use client";

export type SwimlaneBackgroundNodeData = {
  label: string;
  width: number;
  height: number;
};

export function SwimlaneBackgroundNode({ data }: { data: SwimlaneBackgroundNodeData }) {
  return (
    <div
      className="pointer-events-none rounded-lg border border-dashed border-muted-foreground/20 bg-muted/[0.04]"
      style={{ width: data.width, height: data.height }}
    >
      <span className="absolute left-3 top-1 text-[10px] font-semibold text-muted-foreground/80">{data.label}</span>
    </div>
  );
}
