"use client";

import { createContext, useContext } from "react";

export type AssistantTopTab =
  | "geral"
  | "politicas"
  | "faq"
  | "comportamento"
  | "ferramentas"
  | "fluxos"
  | "pipeline"
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
