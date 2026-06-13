export type PostType = "hot_take" | "prediction" | "debate" | "memory" | "post" | "quiz";
export type PostStatus =
  | "active"
  | "settled_correct"
  | "settled_wrong"
  | "pending";
export type SportType = "cricket" | "football";

export interface Post {
  postId: string;
  authorUid: string;
  authorUsername: string;
  authorBadge: string;
  type: PostType;
  sport: SportType;
  text: string;
  sideA?: string;
  sideB?: string;
  matchId?: string;
  confidence?: number;
  audience: string;
  agreeCount: number;
  disagreeCount: number;
  replyCount: number;
  isLive: boolean;
  status: PostStatus;
  mediaUrls?: string[];
  likeCount?: number;
  quizQuestion?: string;
  quizOptions?: { label: string; text: string }[];
  quizCorrectOption?: string;
  quizTimer?: number;
  quizPoints?: number;
  quizParticipants?: number;
  createdAt: number;
  updatedAt: number;
}
