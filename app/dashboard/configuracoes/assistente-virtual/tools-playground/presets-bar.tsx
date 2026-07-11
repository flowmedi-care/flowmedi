"use client";

import { Badge } from "@/components/ui/badge";
import { PLAYGROUND_PRESETS } from "@/lib/virtual-assistant/tools/playground-presets";
import type { PlaygroundPreset } from "@/lib/virtual-assistant/tools/playground-presets";
import { cn } from "@/lib/utils";

type Props = {
  onApply: (preset: PlaygroundPreset) => void;
  activePresetId?: string;
};

export function PresetsBar({ onApply, activePresetId }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Presets:</span>
      {PLAYGROUND_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          title={preset.description}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted",
            activePresetId === preset.id && "border-primary bg-primary/10"
          )}
          onClick={() => onApply(preset)}
        >
          {preset.label}
        </button>
      ))}
      <Badge variant="outline" className="text-[10px]">
        {PLAYGROUND_PRESETS.length} cenários
      </Badge>
    </div>
  );
}
