export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
  sentAt?: string;
};
