import type { Channel } from "../shared/channel";
import type { Conversation } from "./conversation";
import type {
  ClinicId,
  ConversationId,
  ExternalThreadId,
} from "./conversation-id";

export interface ConversationRepository {
  findById(id: ConversationId): Promise<Conversation | null>;
  findByExternalThread(
    clinicId: ClinicId,
    channel: Channel,
    externalThreadId: ExternalThreadId
  ): Promise<Conversation | null>;
  save(conversation: Conversation, expectedVersion: number): Promise<void>;
}

export class OptimisticLockError extends Error {
  constructor(message = "Conversation version conflict") {
    super(message);
    this.name = "OptimisticLockError";
  }
}
