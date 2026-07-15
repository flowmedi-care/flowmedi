export type GeneralSettings = {
  assistantName: string;
  tone: "formal" | "informal";
  useEmojis: boolean;
  transferToHuman: boolean;
  avgWaitTime: string;
  botActiveStart: string;
  botActiveEnd: string;
  debounceSeconds: number;
};
