"use client";

import { cn } from "@/lib/utils";
import type { ParallelTrack } from "@/lib/contact-journey/types";
import { CreditCard, HeadphonesIcon, Star } from "lucide-react";

const TRACK_ICONS = {
  financeiro: CreditCard,
  suporte: HeadphonesIcon,
  pos_atendimento: Star,
};

type JourneyParallelTracksProps = {
  tracks: ParallelTrack[];
};

export function JourneyParallelTracks({ tracks }: JourneyParallelTracksProps) {
  if (tracks.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Trilhas paralelas
      </p>
      {tracks.map((track) => {
        const Icon = TRACK_ICONS[track.kind];
        return (
          <div key={track.kind} className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">{track.label}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {track.steps.map((step) => (
                <span
                  key={step.code}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    step.status === "current" && "border-primary bg-primary/10 text-primary font-medium",
                    step.status === "completed" && "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40",
                    step.status === "upcoming" && "border-border text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
