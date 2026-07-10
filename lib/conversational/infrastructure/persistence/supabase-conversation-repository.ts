import type { SupabaseClient } from "@supabase/supabase-js";
import { Conversation } from "../../domain/conversation/conversation";
import {
  ConversationRepository,
  OptimisticLockError,
} from "../../domain/conversation/conversation-repository";
import { ConversationMapper } from "./conversation-mapper";
import {
  conversationSnapshotSchema,
  type ConversationSnapshot,
} from "./conversation-snapshot";
import type { Channel } from "../../domain/shared/channel";
import { isChannel } from "../../domain/shared/channel";
import type {
  ClinicId,
  ConversationId,
  ExternalThreadId,
} from "../../domain/conversation/conversation-id";
import { nowTimestamp } from "../../domain/shared/timestamp";

const SNAPSHOT_KEY = "north_star_snapshot";

export type LegacyAiState = Record<string, unknown> & {
  north_star_snapshot?: ConversationSnapshot;
};

export class SupabaseConversationRepository implements ConversationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: ConversationId): Promise<Conversation | null> {
    const { data } = await this.supabase
      .from("whatsapp_conversations")
      .select("id, clinic_id, phone_number, ai_state")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return this.fromRow(data);
  }

  async findByExternalThread(
    clinicId: ClinicId,
    channel: Channel,
    externalThreadId: ExternalThreadId
  ): Promise<Conversation | null> {
    if (channel !== "whatsapp") return null;
    const { data } = await this.supabase
      .from("whatsapp_conversations")
      .select("id, clinic_id, phone_number, ai_state")
      .eq("clinic_id", clinicId)
      .eq("phone_number", externalThreadId)
      .maybeSingle();
    if (!data) return null;
    return this.fromRow(data);
  }

  async save(conversation: Conversation, expectedVersion: number): Promise<void> {
    if (conversation.version !== expectedVersion) {
      throw new OptimisticLockError();
    }
    conversation.bumpVersion();
    const snapshot = ConversationMapper.toSnapshot(conversation);
    const { data: row } = await this.supabase
      .from("whatsapp_conversations")
      .select("ai_state")
      .eq("id", conversation.id)
      .single();
    const aiState = ((row?.ai_state ?? {}) as LegacyAiState) ?? {};
    if (
      typeof aiState._north_star_version === "number" &&
      aiState._north_star_version !== expectedVersion
    ) {
      throw new OptimisticLockError();
    }
    const nextState: LegacyAiState = {
      ...aiState,
      [SNAPSHOT_KEY]: snapshot,
      _north_star_version: snapshot.version,
    };
    const { error } = await this.supabase
      .from("whatsapp_conversations")
      .update({ ai_state: nextState })
      .eq("id", conversation.id);
    if (error) throw new Error(error.message);
  }

  async getOrCreate(input: {
    conversationId: ConversationId;
    clinicId: ClinicId;
    channel: Channel;
    externalThreadId: ExternalThreadId;
  }): Promise<Conversation> {
    const existing = await this.findById(input.conversationId);
    if (existing) return existing;

    const conversation = Conversation.openNew({
      id: input.conversationId,
      clinicId: input.clinicId,
      channel: input.channel,
      externalThreadId: input.externalThreadId,
      at: nowTimestamp(),
    });
    await this.save(conversation, 0);
    return conversation;
  }

  private fromRow(row: {
    id: string;
    clinic_id: string;
    phone_number: string;
    ai_state: unknown;
  }): Conversation | null {
    const aiState = (row.ai_state ?? {}) as LegacyAiState;
    const raw = aiState[SNAPSHOT_KEY] ?? aiState.north_star_snapshot;
    if (raw) {
      const parsed = conversationSnapshotSchema.safeParse(raw);
      if (parsed.success) {
        return ConversationMapper.toDomain(parsed.data);
      }
    }
    return Conversation.openNew({
      id: row.id,
      clinicId: row.clinic_id,
      channel: "whatsapp",
      externalThreadId: row.phone_number,
    });
  }
}

export function snapshotFromAiState(aiState: unknown): ConversationSnapshot | null {
  if (!aiState || typeof aiState !== "object") return null;
  const raw = (aiState as LegacyAiState)[SNAPSHOT_KEY];
  if (!raw) return null;
  const parsed = conversationSnapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function channelFromString(value: string): Channel {
  return isChannel(value) ? value : "whatsapp";
}
