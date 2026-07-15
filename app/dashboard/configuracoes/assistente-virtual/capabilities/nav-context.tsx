"use client";

import { createContext, useContext } from "react";

export type AssistantTopTab =
  | "politicas"
  | "fluxos"
  | "avancado"
  | "pipeline"
  | "ferramentas"
  | "diagnostico";

const AssistantNavContext = createContext<{
  openTopTab: (tab: AssistantTopTab) => void;
}>({ openTopTab: () => {} });

export function AssistantNavProvider({
  openTopTab,
  children,
}: {
  openTopTab: (tab: AssistantTopTab) => void;
  children: React.ReactNode;
}) {
  return (
    <AssistantNavContext.Provider value={{ openTopTab }}>
      {children}
    </AssistantNavContext.Provider>
  );
}

export function useAssistantNav() {
  return useContext(AssistantNavContext);
}
