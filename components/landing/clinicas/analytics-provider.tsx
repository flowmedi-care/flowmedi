"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useOutboundLandingTracker } from "@/lib/outbound/tracker";

type Tracker = ReturnType<typeof useOutboundLandingTracker>;

const ClinicasAnalyticsContext = createContext<Tracker | null>(null);

export function ClinicasAnalyticsProvider({ children }: { children: ReactNode }) {
  const tracker = useOutboundLandingTracker();
  return (
    <ClinicasAnalyticsContext.Provider value={tracker}>
      {children}
    </ClinicasAnalyticsContext.Provider>
  );
}

export function useClinicasAnalytics(): Tracker {
  const ctx = useContext(ClinicasAnalyticsContext);
  if (!ctx) {
    throw new Error("useClinicasAnalytics must be used within ClinicasAnalyticsProvider");
  }
  return ctx;
}
