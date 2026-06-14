export type MessageType = "chat" | "prediction" | "hottake";

export interface RoomMessage {
  msgId: string;
  roomId: string;
  authorUid: string;
  authorUsername: string;
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
  memGifUrl?: string;
memTag?: string;

}
