/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: String;
  email: String;
  name: String;
  avatarUrl?: String | null;
  status: String;
  isBlocked: Boolean;
  isAdmin: Boolean;
  createdAt: String;
  updatedAt: String;
}

export interface Friendship {
  id: String;
  senderId: String;
  receiverId: String;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: String;
  sender?: User;
  receiver?: User;
}

export interface MessageReaction {
  id: String;
  messageId: String;
  userId: String;
  reaction: String;
  createdAt: String;
  user?: User;
}

export interface Message {
  id: String;
  senderId: String;
  receiverId: String;
  content: String;
  mediaUrl?: String | null;
  mediaType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'VOICE' | null;
  isRead: Boolean;
  isDelivered: Boolean;
  replyToId?: String | null;
  createdAt: String;
  sender?: User;
  receiver?: User;
  reactions?: MessageReaction[];
  replyTo?: Message | null;
}

export interface CallLog {
  id: String;
  callerId: String;
  receiverId: String;
  type: 'AUDIO' | 'VIDEO';
  status: 'MISSED' | 'COMPLETED' | 'REJECTED' | 'ONGOING';
  duration: number; // in seconds
  createdAt: String;
  caller?: User;
  receiver?: User;
}

export interface SocketUser {
  userId: String;
  socketId: String;
  status: 'online' | 'offline';
  lastSeen?: String;
}

export interface Analytics {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalCalls: number;
}
