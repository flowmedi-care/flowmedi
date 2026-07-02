"use client";

import { createContext, useContext, type ReactNode } from "react";
import { publicSiteBookingPath, publicSiteHomePath } from "@/lib/public-site/urls";

type PublicSitePathContextValue = {
  slug: string;
  onClinicSubdomain: boolean;
  home: (hash?: string) => string;
  booking: (params?: Record<string, string>) => string;
};

const PublicSitePathContext = createContext<PublicSitePathContextValue | null>(null);

export function PublicSitePathProvider({
  slug,
  onClinicSubdomain,
  children,
}: {
  slug: string;
  onClinicSubdomain: boolean;
  children: ReactNode;
}) {
  const value: PublicSitePathContextValue = {
    slug,
    onClinicSubdomain,
    home: (hash) => publicSiteHomePath(slug, onClinicSubdomain, hash),
    booking: (params) => publicSiteBookingPath(slug, onClinicSubdomain, params),
  };

  return (
    <PublicSitePathContext.Provider value={value}>{children}</PublicSitePathContext.Provider>
  );
}

export function usePublicSitePaths(): PublicSitePathContextValue {
  const ctx = useContext(PublicSitePathContext);
  if (!ctx) {
    throw new Error("usePublicSitePaths must be used within PublicSitePathProvider");
  }
  return ctx;
}
