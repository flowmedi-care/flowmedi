import type { Intent } from "../domain/shared/intent";

export type GlobalInterrupt =
  | { type: "cancel" }
  | { type: "handoff" }
  | { type: "menu" };

export type ConfirmationAnswer = "yes" | "no";

export type ResolvedInput = {
  text: string;
  interrupt: GlobalInterrupt | null;
  intent: Intent | null;
  confirmation: ConfirmationAnswer | null;
};

export function emptyResolvedInput(text: string): ResolvedInput {
  return {
    text,
    interrupt: null,
    intent: null,
    confirmation: null,
  };
}
