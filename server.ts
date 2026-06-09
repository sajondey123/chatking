/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { Server as SocketServer } from "socket.io";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { createServer as createViteServer } from "vite";

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "familyconnect_secure_secret_777";

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Config Multer for media storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const origExt = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2)}${origExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB limits
});

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(uploadDir));

// Predefined Admins
const STATIC_ADMINS = [
  { email: "admin1@familyconnect.local", name: "Admin Chief (Sarah)", password: "AdminPassword123!" },
  { email: "admin2@familyconnect.local", name: "Admin Shield (Alex)", password: "AdminPassword456!" }
];

async function seedAdmins() {
  try {
    for (const admin of STATIC_ADMINS) {
      const existing = await prisma.user.findUnique({
        where: { email: admin.email }
      });
      if (!existing) {
        const passwordHash = await bcrypt.hash(admin.password, 10);
        await prisma.user.create({
          data: {
            email: admin.email,
            name: admin.name,
            passwordHash,
            status: "Official Admin Dashboard Overseer",
            isAdmin: true
          }
        });
        console.log(`[Database] Seeded Admin: ${admin.email}`);
      }
    }
  } catch (err) {
    console.error("Error seeding Admins: ", err);
  }
}

// Middleware: Authenticate User
const authenticateUser = async (req: any, res: any, next: any) => {
  try {
    const token = req.cookies.auth_token;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized access: Please login first." });
    }
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    if (!user) {
      return res.status(404).json({ error: "User session expired or user removed." });
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: "Your FamilyConnect account has been blocked by administrators." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid credentials or expired signature." });
  }
};

// Middleware: Authenticate Admin
const authenticateAdmin = async (req: any, res: any, next: any) => {
  authenticateUser(req, res, () => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Elevated administrative privileges are required." });
    }
    next();
  });
};

// ================= API ENDPOINTS =================

// Auth 1: Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Name, email, and password are required fields." });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    if (existing) {
      return res.status(400).json({ error: "An account already exists under this email address." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        status: "Available"
      }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const { passwordHash: _, ...userSafe } = user;
    res.status(201).json(userSafe);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Registration failed." });
  }
});

// Auth 2: Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required credentials." });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    if (!user) {
      return res.status(400).json({ error: "Incorrect email or password combination." });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: "Your FamilyConnect account has been blocked by administrators." });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: "Incorrect email or password combination." });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const { passwordHash: _, ...userSafe } = user;
    res.json(userSafe);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Authentication breakdown" });
  }
});

// Auth 3: Logout
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("auth_token");
  res.json({ success: true, message: "Logged out from FamilyConnect safely." });
});

// Auth 4: Current user profile
app.get("/api/auth/me", authenticateUser, (req: any, res) => {
  const { passwordHash: _, ...userSafe } = req.user;
  res.json(userSafe);
});

// Auth 5: Update Profiling details
app.put("/api/auth/update", authenticateUser, async (req: any, res) => {
  try {
    const { name, status, avatarUrl } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(status !== undefined && { status: status.trim() }),
        ...(avatarUrl !== undefined && { avatarUrl })
      }
    });
    const { passwordHash: _, ...userSafe } = updated;
    res.json(userSafe);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// Media uploading proxy
app.post("/api/messages/upload", authenticateUser, upload.single("file"), (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No media or document payload detected." });
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    res.json({
      url: relativeUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
  } catch (err: any) {
    res.status(500).json({ error: "Storage node failure during upload." });
  }
});

// Contact and directory search
app.get("/api/users/search", authenticateUser, async (req: any, res) => {
  try {
    const query = (req.query.q || "").toString().toLowerCase().trim();
    if (!query) return res.json([]);

    const matchUsers = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { email: { contains: query } }
        ],
        id: { not: req.user.id },
        isBlocked: false
      },
      take: 20
    });

    const safeUsers = matchUsers.map(({ passwordHash: _, ...safe }) => safe);
    res.json(safeUsers);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to query system directories." });
  }
});

// friendship Request APIs
app.post("/api/friends/request", authenticateUser, async (req: any, res) => {
  try {
    const { receiverId } = req.body;
    if (!receiverId || receiverId === req.user.id) {
      return res.status(400).json({ error: "Invalid target user selection." });
    }

    const receiverMatch = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiverMatch) return res.status(404).json({ error: "Target recipient not found." });

    // Check existing
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: req.user.id, receiverId },
          { senderId: receiverId, receiverId: req.user.id }
        ]
      }
    });

    if (existing) {
      return res.status(400).json({ error: "Friendship relation or request already active.", status: existing.status });
    }

    const friendship = await prisma.friendship.create({
      data: {
        senderId: req.user.id,
        receiverId,
        status: "PENDING"
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatarUrl: true, status: true } },
        receiver: { select: { id: true, name: true, email: true, avatarUrl: true, status: true } }
      }
    });

    res.status(201).json(friendship);
  } catch (err) {
    res.status(500).json({ error: "Friendship negotiation failed." });
  }
});

app.post("/api/friends/accept", authenticateUser, async (req: any, res) => {
  try {
    const { requestId } = req.body;
    const friendship = await prisma.friendship.findUnique({ where: { id: requestId } });
    if (!friendship) return res.status(404).json({ error: "Friendship request not found." });

    if (friendship.receiverId !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized request operation." });
    }

    const updated = await prisma.friendship.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
      include: {
        sender: { select: { id: true, name: true, email: true, avatarUrl: true, status: true } },
        receiver: { select: { id: true, name: true, email: true, avatarUrl: true, status: true } }
      }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to establish friendship connection." });
  }
});

app.post("/api/friends/reject", authenticateUser, async (req: any, res) => {
  try {
    const { requestId } = req.body;
    const friendship = await prisma.friendship.findUnique({ where: { id: requestId } });
    if (!friendship) return res.status(404).json({ error: "Friend request record not located." });

    if (friendship.receiverId !== req.user.id && friendship.senderId !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized access path." });
    }

    await prisma.friendship.delete({ where: { id: requestId } });
    res.json({ success: true, message: "Friend request removed." });
  } catch (err) {
    res.status(500).json({ error: "Friend request removal failure." });
  }
});

app.get("/api/friends/list", authenticateUser, async (req: any, res) => {
  try {
    const friends = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: req.user.id },
          { receiverId: req.user.id }
        ]
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatarUrl: true, status: true, isBlocked: true } },
        receiver: { select: { id: true, name: true, email: true, avatarUrl: true, status: true, isBlocked: true } }
      }
    });

    // Strip blocked and filter users
    const filtered = friends.filter(f => !f.sender.isBlocked && !f.receiver.isBlocked);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Cannot retrieve contacts." });
  }
});

// Chat history retrieval
app.get("/api/messages/history/:friendId", authenticateUser, async (req: any, res) => {
  try {
    const targetId = req.params.friendId;
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: targetId },
          { senderId: targetId, receiverId: req.user.id }
        ]
      },
      include: {
        reactions: {
          include: {
            user: { select: { id: true, name: true } }
          }
        },
        replyTo: true
      },
      orderBy: { createdAt: "asc" }
    });

    // Mark these message as read under transactional scope
    await prisma.message.updateMany({
      where: { senderId: targetId, receiverId: req.user.id, isRead: false },
      data: { isRead: true }
    });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to compile messaging history." });
  }
});

// Calls APIs
app.get("/api/calls/history", authenticateUser, async (req: any, res) => {
  try {
    const history = await prisma.callLog.findMany({
      where: {
        OR: [
          { callerId: req.user.id },
          { receiverId: req.user.id }
        ]
      },
      include: {
        caller: { select: { id: true, name: true, email: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, email: true, avatarUrl: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 40
    });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Server unable to compile call logging details." });
  }
});

app.post("/api/calls/log", authenticateUser, async (req: any, res) => {
  try {
    const { receiverId, type, status, duration } = req.body;
    const call = await prisma.callLog.create({
      data: {
        callerId: req.user.id,
        receiverId,
        type,
        status,
        duration: duration || 0
      },
      include: {
        caller: { select: { id: true, name: true, email: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });
    res.status(201).json(call);
  } catch (err) {
    res.status(500).json({ error: "Failed to register call event." });
  }
});


// ================= ADMIN CONSOLE APIS =================

app.get("/api/admin/analytics", authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count({ where: { isAdmin: false } });
    const totalMessages = await prisma.message.count();
    const totalCalls = await prisma.callLog.count();

    // Map active users: defined in the DB with records within last 3 days
    const activeBarrier = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const activeCount = await prisma.user.count({
      where: {
        isAdmin: false,
        updatedAt: { gte: activeBarrier }
      }
    });

    res.json({
      totalUsers,
      activeUsers: activeCount || Math.min(totalUsers, 1),
      totalMessages,
      totalCalls
    });
  } catch (err) {
    res.status(500).json({ error: "Administrative intelligence node diagnostic issue." });
  }
});

app.get("/api/admin/users", authenticateAdmin, async (req, res) => {
  try {
    const q = (req.query.q || "").toString().toLowerCase().trim();
    const users = await prisma.user.findMany({
      where: {
        isAdmin: false,
        ...(q && {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } }
          ]
        })
      },
      orderBy: { createdAt: "desc" }
    });
    const safe = users.map(({ passwordHash: _, ...u }) => u);
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve database directory." });
  }
});

app.post("/api/admin/users/:userId/block", authenticateAdmin, async (req, res) => {
  try {
    const uid = req.params.userId;
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user || user.isAdmin) {
      return res.status(400).json({ error: "Target user is invalid or secure." });
    }

    const updated = await prisma.user.update({
      where: { id: uid },
      data: { isBlocked: !user.isBlocked }
    });

    // Silently notify the blocked user socket to disconnect instantly
    if (updated.isBlocked) {
      io.to(`user_${uid}`).emit("user:forcibly_disconnected", { reason: "Your account is blocked by administrative command." });
    }

    res.json({ success: true, isBlocked: updated.isBlocked });
  } catch (err) {
    res.status(500).json({ error: "Action blocked by operating system boundary." });
  }
});

// View messages between families/users for safety moderation
app.get("/api/admin/users/:userId/messages", authenticateAdmin, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const logs = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: targetUserId },
          { receiverId: targetUserId }
        ]
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Moderator logs retrieval failed." });
  }
});

// Direct call logs for Admin
app.get("/api/admin/logs/calls", authenticateAdmin, async (req, res) => {
  try {
    const calls = await prisma.callLog.findMany({
      include: {
        caller: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ error: "Call logs retrieval failed." });
  }
});


// ================= SOCKET.IO REAL-TIME ROUTING =================

// Store active socket-to-user maps
const activeUsers = new Map<string, string>(); // userId -> socketId
const socketToUser = new Map<string, string>(); // socketId -> userId

// Simple mock/simulation store for admin monitoring
const activeStealthSessions = new Set<string>(); // adminSocketId

io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // User Authenticates Socket connection
  socket.on("auth:register", async ({ userId }) => {
    if (!userId) return;
    activeUsers.set(userId, socket.id);
    socketToUser.set(socket.id, userId);

    const roomName = `user_${userId}`;
    socket.join(roomName);
    console.log(`[Socket] Mapping: User ${userId} is bound to Socket ${socket.id} in room ${roomName}`);

    // Broadcast online status
    socket.broadcast.emit("user:status_change", { userId, status: "online" });
  });

  // Query online status for multiple IDs
  socket.on("user:query_statuses", ({ userIds }: { userIds: string[] }) => {
    const statuses: Record<string, string> = {};
    userIds.forEach(uid => {
      statuses[uid] = activeUsers.has(uid) ? "online" : "offline";
    });
    socket.emit("user:statuses_response", statuses);
  });

  // Real-time messages routing
  socket.on("message:send", async (data: {
    senderId: string;
    receiverId: string;
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    replyToId?: string | null;
  }) => {
    try {
      const dbSender = await prisma.user.findFirst({ where: { id: data.senderId } });
      if (dbSender?.isBlocked) {
        socket.emit("error", { message: "Account blocked." });
        return;
      }

      // Check delivery status
      const isOnline = activeUsers.has(data.receiverId);

      const messageObj = await prisma.message.create({
        data: {
          senderId: data.senderId,
          receiverId: data.receiverId,
          content: data.content,
          mediaUrl: data.mediaUrl || null,
          mediaType: data.mediaType || null,
          replyToId: data.replyToId || null,
          isDelivered: isOnline,
          isRead: false
        },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
          replyTo: true,
          reactions: true
        }
      });

      // Emit to sender for optimistic update anchoring
      socket.emit("message:sent_confirm", messageObj);

      // Route to receiver if online
      if (isOnline) {
        const receiverSocketId = activeUsers.get(data.receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("message:new", messageObj);
        }
      }

      // Forward silently to any Admin currently monitoring this user screen/logs in stealth mode
      io.to("admins_stealth_monitors").emit("admin:monitored_action", {
        type: "chat",
        userId: data.senderId,
        content: data.content,
        recipientName: messageObj.receiverId,
        timestamp: messageObj.createdAt,
        messageObj
      });

    } catch (err) {
      socket.emit("error", { message: "Failed to transmit message." });
    }
  });

  // Typing indicators
  socket.on("typing:status_update", ({ senderId, receiverId, isTyping }) => {
    const receiverSocketId = activeUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing:status_broadcast", { senderId, isTyping });
    }
  });

  // Message Reactions
  socket.on("message:reaction_add", async ({ messageId, userId, reaction }) => {
    try {
      const rx = await prisma.messageReaction.upsert({
        where: {
          messageId_userId: { messageId, userId }
        },
        update: { reaction },
        create: { messageId, userId, reaction },
        include: {
          user: { select: { id: true, name: true } },
          message: true
        }
      });

      // Broadcast reaction change to original sender and receiver
      const rec = activeUsers.get(rx.message.receiverId);
      const sen = activeUsers.get(rx.message.senderId);

      if (rec) io.to(rec).emit("message:reaction_update", rx);
      if (sen) io.to(sen).emit("message:reaction_update", rx);

    } catch (err) {
      console.error("Failure updating reaction: ", err);
    }
  });

  // Message deletion
  socket.on("message:trigger_delete", async ({ messageId, userId, mode }) => {
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg) return;

      if (mode === "everyone") {
        if (msg.senderId !== userId) return; // authorized deletion only

        // Keep database record but alter content to reflect retraction
        const updated = await prisma.message.update({
          where: { id: messageId },
          data: {
            content: "🚫 This message was deleted.",
            mediaUrl: null,
            mediaType: null
          },
          include: { replies: true, reactions: true }
        });

        // Broadcast updated retraction event
        const recSocket = activeUsers.get(msg.receiverId);
        const senSocket = activeUsers.get(msg.senderId);
        if (recSocket) io.to(recSocket).emit("message:updated_retract", updated);
        if (senSocket) io.to(senSocket).emit("message:updated_retract", updated);
      } else {
        // Mode "me" - deleted only locally in client layout. Server can just confirm
        socket.emit("message:deleted_for_me", { messageId });
      }
    } catch (err) {
      console.error("Error retracting message: ", err);
    }
  });


  // ================= WebRTC CALLS ROUTING =================

  socket.on("call:outgoing_initiate", (data: {
    callerId: string;
    receiverId: string;
    type: "AUDIO" | "VIDEO";
    signalData: any;
    callerName: string;
    callerAvatar?: string | null;
  }) => {
    const receiverSocket = activeUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit("call:incoming_ring", {
        callerId: data.callerId,
        type: data.type,
        signalData: data.signalData,
        callerName: data.callerName,
        callerAvatar: data.callerAvatar
      });
      console.log(`[VideoCall] Offer relayed from caller ${data.callerId} to recipient ${data.receiverId}`);
    } else {
      socket.emit("call:offline_rejection", { reason: "User offline" });
    }
  });

  socket.on("call:incoming_answer_relay", (data: {
    callerId: string;
    receiverId: string;
    signalData: any;
  }) => {
    const callerSocket = activeUsers.get(data.callerId);
    if (callerSocket) {
      io.to(callerSocket).emit("call:connection_completed", {
        signalData: data.signalData,
        receiverId: data.receiverId
      });
      console.log(`[VideoCall] Answer relayed from user ${data.receiverId} to caller ${data.callerId}`);
    }
  });

  socket.on("call:terminated", (data: { targetUserId: string }) => {
    const peerSocket = activeUsers.get(data.targetUserId);
    if (peerSocket) {
      io.to(peerSocket).emit("call:peer_hangup");
    }
  });

  socket.on("call:media_control", (data: { targetUserId: string; audioMuted: boolean; videoOff: boolean }) => {
    const peerSocket = activeUsers.get(data.targetUserId);
    if (peerSocket) {
      io.to(peerSocket).emit("call:peer_media_status", {
        audioMuted: data.audioMuted,
        videoOff: data.videoOff
      });
    }
  });

  socket.on("call:ice_candidate_relay", (data: { targetUserId: string; candidate: any }) => {
    const peerSocket = activeUsers.get(data.targetUserId);
    if (peerSocket) {
      io.to(peerSocket).emit("call:peer_ice_candidate", data.candidate);
    }
  });


  // ================= ADMIN OVERSIGHT MONITORING SOCKET ENGINE =================

  // Admin registers to receive oversight session updates
  socket.on("admin:register_stealth_console", () => {
    socket.join("admins_stealth_monitors");
    activeStealthSessions.add(socket.id);
    console.log(`[AdminConsole] Super admin socket joining monitoring group: ${socket.id}`);
  });

  // Admin initiates an oversight handshake with a user (replaces silent trigger)
  socket.on("admin:request_user_spy", ({ targetUserId }: { targetUserId: string }) => {
    const targetSocketId = activeUsers.get(targetUserId);
    const adminUserId = socketToUser.get(socket.id);
    if (targetSocketId) {
      // Trigger a visible consent prompt on the client browser
      io.to(targetSocketId).emit("user:oversight_consent_request", {
        adminSocketId: socket.id,
        adminName: "System Overseer"
      });
      console.log(`[AdminOversight] Consent-based diagnostics request sent to user ${targetUserId}`);
    } else {
      socket.emit("admin:spy_error", { error: "User is currently disconnected/offline." });
    }
  });

  // User responds to the oversight consent request (accepts/declines)
  socket.on("user:oversight_consent_response", ({ adminSocketId, granted }: { adminSocketId: string; granted: boolean }) => {
    io.to(adminSocketId).emit("admin:oversight_consent_result", {
      userId: socketToUser.get(socket.id) || "unknown",
      granted
    });
    console.log(`[AdminOversight] User responded to consent: ${granted ? "GRANTED" : "DENIED"}`);
  });

  // Target client streams back camera canvas frames under active oversight session
  socket.on("user:silent_spy_stream_response", ({ adminSocketId, framePayload, activeChatWith, typingTo }) => {
    io.to(adminSocketId).emit("admin:spy_stream_receive", {
      userId: socketToUser.get(socket.id) || "unknown",
      framePayload,      // canvas content or jpeg b64 payload
      activeChatWith,    // user's active window email/name
      typingTo,
      timestamp: new Date().toISOString()
    });
  });

  // User explicitly revokes active oversight session
  socket.on("user:revoke_oversight_consent", ({ adminSocketId }: { adminSocketId: string }) => {
    io.to(adminSocketId).emit("admin:oversight_revoked", {
      userId: socketToUser.get(socket.id) || "unknown"
    });
    console.log(`[AdminOversight] Oversight consent revoked by user.`);
  });

  // Close connections
  socket.on("disconnect", () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      activeUsers.delete(userId);
      socketToUser.delete(socket.id);
      console.log(`[Socket] Disconnected user: ${userId}`);

      // Broadcast offline changes
      socket.broadcast.emit("user:status_change", { userId, status: "offline" });
    }
    activeStealthSessions.delete(socket.id);
  });
});


// ================= VITE OR STATIC FRONTEND SERVING CLIENTS =================

async function runApplication() {
  await seedAdmins();

  if (process.env.NODE_ENV !== "production") {
    // Vite middleware setup
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Production serving layouts
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Connect Server running on Port ${PORT}`);
  });
}

runApplication();
