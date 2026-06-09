/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { User, Friendship, Message, CallLog } from "./types";

interface CallState {
  id?: string;
  callerId: string;
  receiverId: string;
  type: "AUDIO" | "VIDEO";
  status: "RINGING" | "ONGOING" | "REJECTED" | "MISSED" | "COMPLETED";
  isIncoming: boolean;
  partnerName: string;
  partnerAvatar?: string | null;
  signalData?: any;
}

interface ChatStore {
  user: User | null;
  friends: Friendship[];
  activeFriend: User | null;
  messages: Message[];
  onlineStatuses: Record<string, "online" | "offline">;
  typingStates: Record<string, boolean>; // userId -> isTyping
  activeCall: CallState | null;
  callLogs: CallLog[];
  socket: Socket | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setFriends: (friends: Friendship[]) => void;
  setActiveFriend: (friend: User | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessageInStore: (message: Message) => void;
  setOnlineStatuses: (statuses: Record<string, "online" | "offline">) => void;
  updateOnlineStatus: (userId: string, status: "online" | "offline") => void;
  setTyping: (userId: string, isTyping: boolean) => void;
  setCallLogs: (logs: CallLog[]) => void;
  initSocket: (userId: string) => void;
  disconnectSocket: () => void;
  startCall: (call: CallState) => void;
  updateCallStatus: (status: CallState["status"]) => void;
  endCall: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  user: null,
  friends: [],
  activeFriend: null,
  messages: [],
  onlineStatuses: {},
  typingStates: {},
  activeCall: null,
  callLogs: [],
  socket: null,

  setUser: (user) => {
    set({ user });
    if (user) {
      get().initSocket(user.id);
    } else {
      get().disconnectSocket();
    }
  },

  setFriends: (friends) => set({ friends }),
  setActiveFriend: (activeFriend) => set({ activeFriend }),
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => {
    const { messages, activeFriend, user } = get();
    // Only append if the message is indeed within the active conversation
    const isCurrentChat =
      (message.senderId === activeFriend?.id && message.receiverId === user?.id) ||
      (message.senderId === user?.id && message.receiverId === activeFriend?.id);

    if (isCurrentChat) {
      // Avoid duplicate append (idempotency rule in real-time guidelines)
      const exists = messages.some((m) => m.id === message.id);
      if (!exists) {
        set({ messages: [...messages, message] });
      }
    }
  },

  updateMessageInStore: (msg) => {
    set((state) => ({
      messages: state.messages.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)),
    }));
  },

  setOnlineStatuses: (onlineStatuses) => set({ onlineStatuses }),
  updateOnlineStatus: (userId, status) => {
    set((state) => ({
      onlineStatuses: { ...state.onlineStatuses, [userId]: status },
    }));
  },

  setTyping: (userId, isTyping) => {
    set((state) => ({
      typingStates: { ...state.typingStates, [userId]: isTyping },
    }));
  },

  setCallLogs: (callLogs) => set({ callLogs }),

  initSocket: (userId) => {
    let { socket } = get();
    if (socket) return; // Prevent double instances

    // Establish relative socket stream
    socket = io({
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("[Zustand Store] Connected socket: ", socket?.id);
      socket?.emit("auth:register", { userId });

      // Request and sync online statuses of friends
      const { friends } = get();
      const friendIds = friends.map((f) =>
        f.senderId === userId ? f.receiverId : f.senderId
      );
      if (friendIds.length > 0) {
        socket?.emit("user:query_statuses", { userIds: friendIds });
      }
    });

    socket.on("user:statuses_response", (statuses: Record<string, "online" | "offline">) => {
      set({ onlineStatuses: statuses });
    });

    socket.on("user:status_change", ({ userId: uid, status }) => {
      get().updateOnlineStatus(uid, status);
    });

    socket.on("message:new", (message: Message) => {
      get().addMessage(message);
      
      // Trigger browser push notification or standard visual tab notice if applicable
      if (Notification.permission === "granted") {
        new Notification(`New Message from ${message.sender?.name || "FamilyConnect"}`, {
          body: message.content.substring(0, 60),
        });
      }
    });

    socket.on("message:sent_confirm", (message: Message) => {
      get().addMessage(message);
    });

    socket.on("typing:status_broadcast", ({ senderId, isTyping }) => {
      get().setTyping(senderId, isTyping);
    });

    socket.on("message:reaction_update", (reactionObj: any) => {
      // Find the message in memory and update reaction
      set((state) => ({
        messages: state.messages.map((m) => {
          if (m.id === reactionObj.messageId) {
            const rxExists = m.reactions?.some((r) => r.id === reactionObj.id);
            const filtered = m.reactions?.filter((r) => r.id !== reactionObj.id) || [];
            return {
              ...m,
              reactions: [...filtered, reactionObj],
            };
          }
          return m;
        }),
      }));
    });

    socket.on("message:updated_retract", (updatedMsg: Message) => {
      get().updateMessageInStore(updatedMsg);
    });

    socket.on("user:forcibly_disconnected", ({ reason }) => {
      alert(reason);
      get().setUser(null);
    });

    // Ringing systems signaling pipeline
    socket.on("call:incoming_ring", (data: {
      callerId: string;
      type: "AUDIO" | "VIDEO";
      signalData: any;
      callerName: string;
      callerAvatar?: string | null;
    }) => {
      set({
        activeCall: {
          callerId: data.callerId,
          receiverId: userId,
          type: data.type,
          status: "RINGING",
          isIncoming: true,
          partnerName: data.callerName,
          partnerAvatar: data.callerAvatar,
          signalData: data.signalData,
        },
      });
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  startCall: (call) => {
    set({ activeCall: call });
    const { socket } = get();
    if (socket && !call.isIncoming) {
      socket.emit("call:outgoing_initiate", {
        callerId: call.callerId,
        receiverId: call.receiverId,
        type: call.type,
        signalData: call.signalData,
        callerName: call.partnerName, // Sender passes their own name
      });
    }
  },

  updateCallStatus: (status) => {
    set((state) => ({
      activeCall: state.activeCall ? { ...state.activeCall, status } : null,
    }));
  },

  endCall: () => {
    const { socket, activeCall } = get();
    if (socket && activeCall) {
      const partnerId = activeCall.isIncoming ? activeCall.callerId : activeCall.receiverId;
      socket.emit("call:terminated", { targetUserId: partnerId });
    }
    set({ activeCall: null });
  },
}));
