"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type DashboardNavigationContextValue = {
  pathname: string;
  displayPathname: string;
  pendingHref: string | null;
  isNavigating: boolean;
  startNavigation: (href: string) => void;
};

const DashboardNavigationContext = createContext<DashboardNavigationContextValue | null>(
  null
);

export function DashboardNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const startNavigation = useCallback((href: string) => {
    setPendingHref(href);
  }, []);

  const value = useMemo(
    () => ({
      pathname,
      displayPathname: pendingHref ?? pathname,
      pendingHref,
      isNavigating: pendingHref !== null && pendingHref !== pathname,
      startNavigation,
    }),
    [pathname, pendingHref, startNavigation]
  );

  return (
    <DashboardNavigationContext.Provider value={value}>
      {children}
    </DashboardNavigationContext.Provider>
  );
}

export function useDashboardNavigation() {
  const context = useContext(DashboardNavigationContext);
  if (!context) {
    throw new Error(
      "useDashboardNavigation must be used within DashboardNavigationProvider"
    );
  }
  return context;
}
