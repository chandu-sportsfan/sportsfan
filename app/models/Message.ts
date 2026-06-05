export interface ChatRoom {
  roomId: string;
  name: string;

  membersCount: number;

  createdAt: number;

  isActive: boolean;
}
