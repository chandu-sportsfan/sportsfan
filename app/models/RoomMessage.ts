// app/models/RoomMessage.ts


export type MessageType = "chat" | "post" | "prediction" | "hottake" | "hot_take" | "debate" | "raw_reactions" | "memory" | "quiz" | "predictions_live";

export interface RoomMessage {
  msgId: string;
  roomId: string;
  authorUid: string;
  authorUsername: string;
  authorEmail?: string;
  authorBadge: string;
  text: string;
  type: MessageType;
  fireCount: number;
  noChanceCount: number;
  agreeCount: number;
  disagreeCount: number;
  replyCount: number;
  createdAt: number;
  mediaUrls?: string[];
  heartCount?: number;   // ← add
  sideA?: string;        // ← add
  sideB?: string;
  questions?: { question: string; options: { label: string; emoji: string }[] }[];
  matchTitle?: string;
  predictionOptions?: string[];
  predictionOptionCounts?: Record<string, number>;
  closesAt?: number;
  closedAt?: number;
  resolvedAt?: number;
  correctVote?: string;
  accuracyAwarded?: boolean;
  memGifUrl?: string;
  memTag?: string;

}
