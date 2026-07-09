import type { GraphState } from "../../langgraph/state";
import type { ReplySource } from "../../langgraph/trace";

export type PartialGraphUpdate = Partial<GraphState> & {
  replySource?: ReplySource;
};
