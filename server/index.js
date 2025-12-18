// ecotalk/server/index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "100mb" }));

const prisma = new PrismaClient();
const server = http.createServer(app);
const SECRET_KEY = "eco-secret-key";

const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e8,
});

// ===== SHOP CONFIG (Цены должны совпадать с клиентом) =====
const SHOP_PRICES = {
  // Frames
  'gold': 500,
  'neon': 1000,
  'ruby': 2500,
  'nature': 300,
  'fire': 5000,
  // Banners
  'blue': 100,
  'purple': 100,
  'gold': 1000,
  'forest': 200,
  'crimson': 300,
  'night': 500,
  'gray': 50
};

// ======================= HELPERS =======================
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; // { id, username }
    next();
  });
};

const safeJsonParse = (s, fallback) => {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

async function getUserFriends(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const ids = safeJsonParse(user?.friendsData || "[]", []);
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return prisma.user.findMany({ where: { id: { in: ids } } });
}

async function addFriendBothWays(aId, bId) {
  if (aId === bId) return;

  const [a, b] = await Promise.all([
    prisma.user.findUnique({ where: { id: aId } }),
    prisma.user.findUnique({ where: { id: bId } }),
  ]);
  if (!a || !b) return;

  const aList = safeJsonParse(a.friendsData || "[]", []);
  const bList = safeJsonParse(b.friendsData || "[]", []);

  if (!aList.includes(bId)) aList.push(bId);
  if (!bList.includes(aId)) bList.push(aId);

  await Promise.all([
    prisma.user.update({ where: { id: aId }, data: { friendsData: JSON.stringify(aList) } }),
    prisma.user.update({ where: { id: bId }, data: { friendsData: JSON.stringify(bList) } }),
  ]);
}

async function removeFriendBothWays(aId, bId) {
  const [a, b] = await Promise.all([
    prisma.user.findUnique({ where: { id: aId } }),
    prisma.user.findUnique({ where: { id: bId } }),
  ]);
  if (!a || !b) return;

  const aList = safeJsonParse(a.friendsData || "[]", []).filter((x) => x !== bId);
  const bList = safeJsonParse(b.friendsData || "[]", []).filter((x) => x !== aId);

  await Promise.all([
    prisma.user.update({ where: { id: aId }, data: { friendsData: JSON.stringify(aList) } }),
    prisma.user.update({ where: { id: bId }, data: { friendsData: JSON.stringify(bList) } }),
  ]);
}

async function isServerOwner(serverId, userId) {
  const s = await prisma.server.findUnique({ where: { id: serverId } });
  return !!s && s.ownerId === userId;
}

async function ensureMember(serverId, userId) {
  const exists = await prisma.member.findFirst({ where: { serverId, userId } });
  if (exists) return exists;
  return prisma.member.create({ data: { serverId, userId } });
}

// ======================= VOICE STATE =======================
const rooms = {};
const socketToRoom = {};

const broadcastRoomUsers = async (roomId) => {
  if (!roomId || !rooms[roomId]) return;

  const users = [];
  const unique = new Set();

  for (const p of rooms[roomId]) {
    if (!p?.userId || unique.has(p.userId)) continue;
    unique.add(p.userId);
    const u = await prisma.user.findUnique({ where: { id: p.userId } });
    if (u) {
      users.push({ id: u.id, username: u.username, avatar: u.avatar, socketId: p.socketId, frame: u.frame });
    }
  }

  io.emit("voice_room_update", { roomId, users });
};

const leaveRoomBySocket = async (socket) => {
  const r = socketToRoom[socket.id];
  if (!r) return;

  if (rooms[r]) {
    rooms[r] = rooms[r].filter((p) => p.socketId !== socket.id);
    if (rooms[r].length === 0) delete rooms[r];
    else await broadcastRoomUsers(r);
  }

  delete socketToRoom[socket.id];
  io.emit("user_left_voice", socket.id); 
};

// ======================= AUTH & USER =======================

app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.sendStatus(404);

    const friendsList = await getUserFriends(user.id);
    const notifications = await prisma.notification.findMany({
      where: { receiverId: user.id },
      include: { sender: true, server: true },
      orderBy: { createdAt: "desc" },
    });

    const memberships = await prisma.member.findMany({
      where: { userId: user.id },
      include: { server: true },
    });

    res.json({ 
        ...user, 
        friendsList, 
        notifications,
        servers: memberships 
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

// Update Profile
app.put('/api/me', authenticateToken, async (req, res) => {
  try {
    const { username, avatar, frame, banner } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { 
        username, 
        avatar,
        frame, 
        banner 
      }
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка" });
  }
});

// === SHOP BUY ===
app.post("/api/shop/buy", authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.body;
    const price = SHOP_PRICES[itemId];

    if (!price) return res.status(400).json({ error: "Item not found" });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.coins < price) return res.status(400).json({ error: "Not enough coins" });

    const inventory = safeJsonParse(user.inventory, []);
    if (inventory.includes(itemId)) return res.status(400).json({ error: "Already owned" });

    inventory.push(itemId);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        coins: { decrement: price },
        inventory: JSON.stringify(inventory)
      }
    });

    res.json({ coins: updated.coins, inventory });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Transaction failed" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing username/password" });

  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(400).json({ error: "Taken" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        status: "online",
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
        friendsData: "[]",
        coins: 100, // Бонус за регистрацию
      },
    });

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing username/password" });

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(400).json({ error: "Invalid" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Invalid" });

    await prisma.user.update({ where: { id: user.id }, data: { status: "online" } });

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

// ======================= SERVERS =======================

app.post("/api/servers", authenticateToken, async (req, res) => {
  try {
    const { name, icon, description } = req.body || {};
    if (!name) return res.status(400).json({ error: "Missing name" });

    const created = await prisma.server.create({
      data: {
        name,
        icon: icon || null,
        description: description || null,
        ownerId: req.user.id,
        channels: {
          create: [
            { name: "general", type: "text" },
            { name: "voice", type: "voice" },
          ],
        },
        members: {
          create: [{ userId: req.user.id }],
        },
      },
      include: { channels: true },
    });

    res.json(created);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.get("/api/server/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const serverData = await prisma.server.findUnique({
      where: { id },
      include: {
        channels: true,
        owner: true,
        members: { include: { user: true } },
      },
    });

    if (!serverData) return res.status(404).json({ error: "Server not found" });
    res.json(serverData);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.put("/api/server/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const owner = await isServerOwner(id, req.user.id);
    if (!owner) return res.status(403).json({ error: "Forbidden" });

    const { name, description, icon } = req.body || {};
    const updated = await prisma.server.update({
      where: { id },
      data: {
        name: typeof name === "string" ? name : undefined,
        description: typeof description === "string" ? description : undefined,
        icon: typeof icon === "string" ? icon : undefined,
      },
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.delete("/api/server/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const owner = await isServerOwner(id, req.user.id);
    if (!owner) return res.status(403).json({ error: "Forbidden" });

    await prisma.server.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.delete("/api/server/:serverId/kick/:userId", authenticateToken, async (req, res) => {
  try {
    const serverId = Number(req.params.serverId);
    const userId = Number(req.params.userId);

    const owner = await isServerOwner(serverId, req.user.id);
    if (!owner) return res.status(403).json({ error: "Forbidden" });

    await prisma.member.deleteMany({ where: { serverId, userId } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.post("/api/servers/invite", authenticateToken, async (req, res) => {
  try {
    const { serverId, username } = req.body || {};
    const sid = Number(serverId);
    if (!sid || !username) return res.status(400).json({ error: "Missing serverId/username" });

    const owner = await isServerOwner(sid, req.user.id);
    if (!owner) return res.status(403).json({ error: "Forbidden" });

    const receiver = await prisma.user.findUnique({ where: { username } });
    if (!receiver) return res.status(404).json({ error: "User not found" });

    const alreadyMember = await prisma.member.findFirst({ where: { serverId: sid, userId: receiver.id } });
    if (alreadyMember) return res.json({ ok: true });

    const notif = await prisma.notification.create({
      data: {
        type: "SERVER_INVITE",
        senderId: req.user.id,
        receiverId: receiver.id,
        serverId: sid,
        status: "PENDING",
      },
      include: { sender: true, server: true },
    });

    io.to(`user_${receiver.id}`).emit("new_notification", notif);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

// ======================= CHANNELS =======================
app.post("/api/channels", authenticateToken, async (req, res) => {
  try {
    const { name, type, serverId } = req.body || {};
    const sid = Number(serverId);
    if (!name || !sid) return res.status(400).json({ error: "Missing name/serverId" });

    const owner = await isServerOwner(sid, req.user.id);
    if (!owner) return res.status(403).json({ error: "Forbidden" });

    const channel = await prisma.channel.create({
      data: { name, type: type || "text", serverId: sid },
    });

    res.json(channel);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.put("/api/channels/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "Missing name" });

    const ch = await prisma.channel.findUnique({ where: { id } });
    if (!ch) return res.status(404).json({ error: "Not found" });

    const owner = await isServerOwner(ch.serverId, req.user.id);
    if (!owner) return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.channel.update({ where: { id }, data: { name } });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.delete("/api/channels/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const ch = await prisma.channel.findUnique({ where: { id } });
    if (!ch) return res.status(404).json({ error: "Not found" });

    const owner = await isServerOwner(ch.serverId, req.user.id);
    if (!owner) return res.status(403).json({ error: "Forbidden" });

    await prisma.channel.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

// ======================= FRIENDS =======================
app.post("/api/friends/invite", authenticateToken, async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: "Missing username" });

    const receiver = await prisma.user.findUnique({ where: { username } });
    if (!receiver) return res.status(404).json({ error: "User not found" });
    if (receiver.id === req.user.id) return res.status(400).json({ error: "Cannot add yourself" });

    const me = await prisma.user.findUnique({ where: { id: req.user.id } });
    const list = safeJsonParse(me?.friendsData || "[]", []);
    if (list.includes(receiver.id)) return res.json({ ok: true });

    const existingNotif = await prisma.notification.findFirst({
      where: {
        type: "FRIEND_REQUEST",
        senderId: req.user.id,
        receiverId: receiver.id,
        status: "PENDING",
      },
    });
    if (existingNotif) return res.json({ ok: true });

    const notif = await prisma.notification.create({
      data: {
        type: "FRIEND_REQUEST",
        senderId: req.user.id,
        receiverId: receiver.id,
        status: "PENDING",
      },
      include: { sender: true, server: true },
    });

    io.to(`user_${receiver.id}`).emit("new_notification", notif);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.delete("/api/friends/:friendId", authenticateToken, async (req, res) => {
  try {
    const friendId = Number(req.params.friendId);
    await removeFriendBothWays(req.user.id, friendId);
    io.to(`user_${friendId}`).emit("friend_removed", req.user.id);
    io.to(`user_${req.user.id}`).emit("friend_removed", friendId);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

// ======================= NOTIFICATIONS =======================
app.post("/api/notifications/respond", authenticateToken, async (req, res) => {
  try {
    const { notificationId, action } = req.body || {};
    const id = Number(notificationId);
    if (!id || !["ACCEPT", "DECLINE"].includes(action)) {
      return res.status(400).json({ error: "Bad request" });
    }

    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif) return res.status(404).json({ error: "Not found" });
    if (notif.receiverId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    if (notif.status !== "PENDING") return res.json({ ok: true });

    if (action === "DECLINE") {
      await prisma.notification.update({ where: { id }, data: { status: "DECLINED" } });
      return res.json({ ok: true });
    }

    // ACCEPT
    if (notif.type === "FRIEND_REQUEST") {
      await addFriendBothWays(notif.senderId, notif.receiverId);
      await prisma.notification.update({ where: { id }, data: { status: "ACCEPTED" } });

      const sender = await prisma.user.findUnique({ where: { id: notif.senderId } });
      const receiver = await prisma.user.findUnique({ where: { id: notif.receiverId } });

      if (sender) io.to(`user_${receiver.id}`).emit("friend_added", sender);
      if (receiver) io.to(`user_${sender.id}`).emit("friend_added", receiver);

      return res.json({ ok: true });
    }

    if (notif.type === "SERVER_INVITE") {
      if (!notif.serverId) {
        await prisma.notification.update({ where: { id }, data: { status: "DECLINED" } });
        return res.status(400).json({ error: "No serverId in invite" });
      }

      await ensureMember(notif.serverId, notif.receiverId);
      await prisma.notification.update({ where: { id }, data: { status: "ACCEPTED" } });
      return res.json({ ok: true });
    }

    // default accept
    await prisma.notification.update({ where: { id }, data: { status: "ACCEPTED" } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

// ======================= MESSAGES =======================
app.put("/api/messages/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { content } = req.body || {};
    if (typeof content !== "string") return res.status(400).json({ error: "Bad content" });

    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ error: "Not found" });
    if (msg.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.message.update({
      where: { id },
      data: { content, isEdited: true },
      include: { user: true, reactions: { include: { user: true } } },
    });

    const room = updated.channelId ? `channel_${updated.channelId}` : updated.dmRoom;
    if (room) io.to(room).emit("message_updated", updated);

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.delete("/api/messages/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ error: "Not found" });
    if (msg.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    await prisma.message.delete({ where: { id } });

    const room = msg.channelId ? `channel_${msg.channelId}` : msg.dmRoom;
    if (room) io.to(room).emit("message_deleted", id);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

app.post("/api/messages/:id/react", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { emoji } = req.body || {};
    if (!emoji) return res.status(400).json({ error: "Missing emoji" });

    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ error: "Not found" });

    const existing = await prisma.reaction.findFirst({
      where: { messageId: id, userId: req.user.id, emoji },
    });

    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.reaction.create({
        data: { emoji, userId: req.user.id, messageId: id },
      });
    }

    const updated = await prisma.message.findUnique({
      where: { id },
      include: { user: true, reactions: { include: { user: true } } },
    });

    const room = updated.channelId ? `channel_${updated.channelId}` : updated.dmRoom;
    if (room) io.to(room).emit("message_updated", updated);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error" });
  }
});

// ======================= SOCKET.IO =======================
io.on("connection", (socket) => {
  // ---------- AUTH USER ----------
  socket.on("auth_user", async (userId) => {
    try {
      socket.userId = userId;
      socket.join(`user_${userId}`);
      await prisma.user.update({ where: { id: userId }, data: { status: "online" } });
      io.emit("user_status_changed", { userId, status: "online", lastSeen: null });
    } catch (e) {
      console.error(e);
    }
  });

  // ---------- DISCONNECT ----------
  socket.on("disconnect", async () => {
    try {
      await leaveRoomBySocket(socket);

      if (socket.userId) {
        prisma.user
          .update({
            where: { id: socket.userId },
            data: { status: "offline", lastSeen: new Date() },
          })
          .catch(() => {});
        io.emit("user_status_changed", {
          userId: socket.userId,
          status: "offline",
          lastSeen: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error(e);
    }
  });

  // ---------- TEXT CHANNEL ----------
  socket.on("join_channel", async ({ channelId }) => {
    try {
      const room = `channel_${channelId}`;
      socket.join(room);

      const history = await prisma.message.findMany({
        where: { channelId: Number(channelId) },
        orderBy: { createdAt: "asc" },
        include: { user: true, reactions: { include: { user: true } } },
      });

      socket.emit("load_history", history);
    } catch (e) {
      console.error(e);
    }
  });

  // ---------- DM ----------
  socket.on("join_dm", async ({ roomName }) => {
    try {
      const room = String(roomName);
      socket.join(room);

      const history = await prisma.message.findMany({
        where: { dmRoom: room },
        orderBy: { createdAt: "asc" },
        include: { user: true, reactions: { include: { user: true } } },
      });

      socket.emit("load_history", history);
    } catch (e) {
      console.error(e);
    }
  });

  // ---------- TYPING ----------
  socket.on("typing", ({ room }) => {
    if (!socket.userId) return;
    socket.to(room).emit("user_typing", socket.userId);
  });

  socket.on("stop_typing", ({ room }) => {
    if (!socket.userId) return;
    socket.to(room).emit("user_stop_typing", socket.userId);
  });

  // ---------- SEND MESSAGE ----------
  socket.on("send_message", async (data) => {
    try {
      const { content, imageUrl, author, userId, channelId, dmRoom, type } = data || {};

      const m = await prisma.message.create({
        data: {
          content: content ?? null,
          imageUrl: imageUrl ?? null,
          author: author || "Unknown",
          userId: Number(userId),
          channelId: channelId ? Number(channelId) : null,
          dmRoom: dmRoom ? String(dmRoom) : null,
          type: type || "text",
        },
        include: { user: true, reactions: { include: { user: true } } },
      });

      // === ECO: Add Coin ===
      try {
        const updatedUser = await prisma.user.update({
            where: { id: Number(userId) },
            data: { coins: { increment: 1 } }
        });
        socket.emit("balance_update", updatedUser.coins);
      } catch (err) {}
      // ====================

      const room = m.channelId ? `channel_${m.channelId}` : m.dmRoom;
      if (room) io.to(room).emit("receive_message", m);
    } catch (e) {
      console.error(e);
    }
  });

  // ---------- VOICE: REQUEST CURRENT STATES ----------
  socket.on("request_voice_states", async () => {
    try {
      for (const roomId of Object.keys(rooms)) {
        await broadcastRoomUsers(roomId);
      }
    } catch (e) {
      console.error(e);
    }
  });

  // ---------- VOICE: JOIN/LEAVE ----------
  socket.on("join_voice_channel", async (roomId) => {
    try {
      if (!socket.userId) return;
      await leaveRoomBySocket(socket);

      const rid = String(roomId);
      if (!rooms[rid]) rooms[rid] = [];
      rooms[rid].push({ socketId: socket.id, userId: socket.userId });
      socketToRoom[socket.id] = rid;

      const others = rooms[rid].filter((p) => p.socketId !== socket.id).map((p) => p.socketId);
      socket.emit("all_users_in_voice", others);

      rooms[rid]
        .filter((p) => p.socketId !== socket.id)
        .forEach((p) => io.to(p.socketId).emit("user_joined_voice", { callerID: socket.id, signal: null }));

      await broadcastRoomUsers(rid);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("leave_voice_channel", async () => {
    try {
      await leaveRoomBySocket(socket);
    } catch (e) {
      console.error(e);
    }
  });

  // ---------- WEBRTC SIGNALING (simple-peer) ----------
  socket.on("sending_signal", ({ userToSignal, callerID, signal }) => {
    io.to(userToSignal).emit("user_joined_voice", { callerID, signal });
  });

  socket.on("returning_signal", ({ callerID, signal }) => {
    io.to(callerID).emit("receiving_returned_signal", { id: socket.id, signal });
  });
});

// ======================= START =======================
server.listen(3001, () => {
  console.log("✅ SERVER READY ON 3001");
});