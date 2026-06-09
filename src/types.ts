/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  status: string;
  isBlocked: boolean;
  isAdmin: boolean;
  adminAccessAllowed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Friendship {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  sender?: User;
  receiver?: User;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  reaction: string;
  createdAt: string;
  user?: User;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'VOICE' | null;
  isRead: boolean;
  isDelivered: boolean;
  replyToId?: string | null;
  createdAt: string;
  sender?: User;
  receiver?: User;
  reactions?: MessageReaction[];
  replyTo?: Message | null;
}

export interface CallLog {
  id: string;
  callerId: string;
  receiverId: string;
  type: 'AUDIO' | 'VIDEO';
  status: 'MISSED' | 'COMPLETED' | 'REJECTED' | 'ONGOING';
  duration: number; // in seconds
  createdAt: string;
  caller?: User;
  receiver?: User;
}

export interface SocketUser {
  userId: string;
  socketId: string;
  status: 'online' | 'offline';
  lastSeen?: string;
}

export interface Analytics {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalCalls: number;
}
