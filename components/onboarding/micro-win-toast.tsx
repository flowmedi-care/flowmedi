"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export function MicroWinToast({
  message,
  onDone,
}: {
  message: string | null;
  onDone?: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 2800);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message || !visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-24 left-1/2 z-[60] flex max-w-sm -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-500/30 bg-background px-4 py-3 shadow-lg sm:bottom-8",
        "animate-in fade-in slide-in-from-bottom-2"
      )}
      role="status"
    >
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
      <p className="text-sm font-medium text-foreground">{message}</p>
    </div>
  );
}
