import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();
const SECRET_KEY = "super-secret-key-change-it"; // В продакшене хранить в .env

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" })); // Увеличили лимит для картинок

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// === API ROUTES ===

// 1. Регистрация
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashedPassword },
    });
    
    const token = jwt.sign({ userId: user.id }, SECRET_KEY);
    res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar } });
  } catch (e) {
    res.status(400).json({ error: "Username already taken" });
  }
});

// 2. Логин
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user.id }, SECRET_KEY);
    res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar } });
  } catch (e) {
    res.status(500).json({ error: "Error" });
  }
});

// Middleware для проверки токена
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded: any = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// 3. Получение профиля (Me)
app.get("/api/me", authenticate, async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      servers: { include: { server: true } },
      owned: true,
    },
  });
  
  // Получаем список друзей
  let friendsList: any[] = [];
  if (user?.friendsData) {
    const friendIds = JSON.parse(user.friendsData);
    friendsList = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: { id: true, username: true, avatar: true, status: true, lastSeen: true }
    });
  }

  res.json({ ...user, friendsList });
});

// 4. Обновление профиля (Аватар)
app.put("/api/me", authenticate, async (req: any, res) => {
  const { username, avatar } = req.body;
  await prisma.user.update({
    where: { id: req.userId },
    data: { username, avatar },
  });
  res.json({ success: true });
});

// 5. Создать сервер
app.post("/api/servers", authenticate, async (req: any, res) => {
  const { name } = req.body;
  const server = await prisma.server.create({
    data: {
      name,
      ownerId: req.userId,
      channels: { create: [{ name: "general", type: "text" }, { name: "General Voice", type: "voice" }] },
      members: { create: { userId: req.userId } }
    },
    include: { channels: true }
  });
  res.json(server);
});

// 6. Получить данные сервера
app.get("/api/server/:id", authenticate, async (req, res) => {
  const server = await prisma.server.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      channels: true,
      members: { include: { user: { select: { id: true, username: true, avatar: true, status: true } } } }
    }
  });
  res.json(server);
});

// 7. Создать канал
app.post("/api/channels", authenticate, async (req: any, res) => {
  const { name, serverId, type } = req.body;
  // Проверка прав (владелец)
  const server = await prisma.server.findUnique({ where: { id: Number(serverId) } });
  if (server?.ownerId !== req.userId) return res.status(403).json({ error: "Not owner" });

  const channel = await prisma.channel.create({
    data: { name, serverId: Number(serverId), type }
  });
  res.json(channel);
});

// 8. Удалить сервер
app.delete("/api/server/:id", authenticate, async (req: any, res) => {
  const serverId = Number(req.params.id);
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (server?.ownerId !== req.userId) return res.status(403).json({ error: "Not owner" });
  
  await prisma.server.delete({ where: { id: serverId } });
  res.json({ success: true });
});

// 9. Пригласить друга (упрощено - добавляем по нику в друзья)
app.post("/api/friends/invite", authenticate, async (req: any, res) => {
    const { username } = req.body;
    const target = await prisma.user.findUnique({ where: { username } });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.id === req.userId) return res.status(400).json({ error: "Self add" });
    
    // Создаем уведомление
    const notif = await prisma.notification.create({
        data: {
            type: "FRIEND_REQUEST",
            senderId: req.userId,
            receiverId: target.id,
        },
        include: { sender: true }
    });
    
    // Отправляем сокет уведомления
    const socketId = userSockets[target.id];
    if (socketId) io.to(socketId).emit("new_notification", notif);
    
    res.json({ success: true });
});

// 10. Ответ на уведомление
app.post("/api/notifications/respond", authenticate, async (req: any, res) => {
    const { notificationId, action } = req.body;
    const notif = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notif) return res.status(404).json({ error: "Not found" });
    
    if (action === "ACCEPT") {
        if (notif.type === "FRIEND_REQUEST") {
            // Добавляем в друзья обоим (простое обновление JSON)
            const u1 = await prisma.user.findUnique({ where: { id: notif.senderId } });
            const u2 = await prisma.user.findUnique({ where: { id: notif.receiverId } });
            
            const list1 = u1?.friendsData ? JSON.parse(u1.friendsData) : [];
            const list2 = u2?.friendsData ? JSON.parse(u2.friendsData) : [];
            
            if (!list1.includes(u2!.id)) list1.push(u2!.id);
            if (!list2.includes(u1!.id)) list2.push(u1!.id);
            
            await prisma.user.update({ where: { id: u1!.id }, data: { friendsData: JSON.stringify(list1) } });
            await prisma.user.update({ where: { id: u2!.id }, data: { friendsData: JSON.stringify(list2) } });
            
            // Оповещаем сокеты
            if (userSockets[u1!.id]) io.to(userSockets[u1!.id]).emit("friend_added", u2);
            if (userSockets[u2!.id]) io.to(userSockets[u2!.id]).emit("friend_added", u1);
        }
        else if (notif.type === "SERVER_INVITE" && notif.serverId) {
             await prisma.member.create({
                 data: { userId: notif.receiverId, serverId: notif.serverId }
             });
        }
    }
    
    await prisma.notification.delete({ where: { id: notificationId } });
    res.json({ success: true });
});

// 11. Удалить друга
app.delete("/api/friends/:id", authenticate, async (req: any, res) => {
    const friendId = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    let list = user?.friendsData ? JSON.parse(user.friendsData) : [];
    list = list.filter((id: number) => id !== friendId);
    await prisma.user.update({ where: { id: req.userId }, data: { friendsData: JSON.stringify(list) } });
    res.json({ success: true });
});

// 12. Удалить сообщение
app.delete("/api/messages/:id", authenticate, async (req: any, res) => {
    const msg = await prisma.message.findUnique({ where: { id: Number(req.params.id) } });
    if (!msg || msg.userId !== req.userId) return res.status(403).send("No");
    await prisma.message.delete({ where: { id: Number(req.params.id) } });
    io.emit("message_deleted", Number(req.params.id));
    res.json({success: true});
});

// 13. Реакция на сообщение
app.post("/api/messages/:id/react", authenticate, async (req: any, res) => {
    const { emoji } = req.body;
    const msgId = Number(req.params.id);
    
    // Проверяем, ставил ли уже
    const existing = await prisma.reaction.findFirst({ where: { messageId: msgId, userId: req.userId, emoji } });
    
    if (existing) {
        await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
        await prisma.reaction.create({ data: { messageId: msgId, userId: req.userId, emoji } });
    }
    
    // Возвращаем обновленное сообщение
    const updatedMsg = await prisma.message.findUnique({ 
        where: { id: msgId },
        include: { user: true, reactions: { include: { user: true } } }
    });
    
    // Трансформируем для клиента
    const payload = {
        ...updatedMsg,
        userCustom: updatedMsg?.userCustomData ? JSON.parse(updatedMsg.userCustomData) : null
    };

    io.emit("message_updated", payload);
    res.json({success: true});
});

// 14. Редактировать сообщение
app.put("/api/messages/:id", authenticate, async (req: any, res) => {
    const { content } = req.body;
    const msg = await prisma.message.findUnique({ where: { id: Number(req.params.id) } });
    if (!msg || msg.userId !== req.userId) return res.status(403).send("No");
    
    const updated = await prisma.message.update({
        where: { id: Number(req.params.id) },
        data: { content, isEdited: true },
        include: { user: true, reactions: { include: { user: true } } }
    });
    
    const payload = {
        ...updated,
        userCustom: updated.userCustomData ? JSON.parse(updated.userCustomData) : null
    };

    io.emit("message_updated", payload);
    res.json({success: true});
});

// 15. Инвайт на сервер
app.post("/api/servers/invite", authenticate, async (req: any, res) => {
    const { serverId, username } = req.body;
    const target = await prisma.user.findUnique({ where: { username } });
    if (!target) return res.status(404).json({ error: "User not found" });

    // Проверка, что юзер уже не на сервере
    const exists = await prisma.member.findFirst({ where: { userId: target.id, serverId } });
    if (exists) return res.status(400).json({ error: "Already a member" });

    const notif = await prisma.notification.create({
        data: {
            type: "SERVER_INVITE",
            senderId: req.userId,
            receiverId: target.id,
            serverId
        },
        include: { sender: true, server: true } // Include server info
    });

    const socketId = userSockets[target.id];
    if (socketId) io.to(socketId).emit("new_notification", notif);
    
    res.json({ success: true });
});


// === SOCKET.IO LOGIC ===
const userSockets: Record<number, string> = {}; // userId -> socketId
const voiceRooms: Record<number, string[]> = {}; // roomId -> [socketId, socketId]

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("auth_user", async (userId: number) => {
    userSockets[userId] = socket.id;
    // Update status to online
    await prisma.user.update({ where: { id: userId }, data: { status: "online", lastSeen: new Date() } });
    io.emit("user_status_changed", { userId, status: "online" });
  });

  // --- TEXT CHAT ---
  socket.on("join_channel", async ({ channelId }) => {
    socket.join(`channel_${channelId}`);
    // Load history
    const messages = await prisma.message.findMany({
      where: { channelId },
      include: { user: true, reactions: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
      take: 50
    });
    
    // Parse custom styles for history
    const formatted = messages.map(m => ({
        ...m,
        userCustom: m.userCustomData ? JSON.parse(m.userCustomData) : null
    }));
    
    socket.emit("load_history", formatted);
  });

  socket.on("join_dm", async ({ roomName }) => {
    socket.join(roomName);
    const messages = await prisma.message.findMany({
      where: { dmRoom: roomName },
      include: { user: true, reactions: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
      take: 50
    });
    
    const formatted = messages.map(m => ({
        ...m,
        userCustom: m.userCustomData ? JSON.parse(m.userCustomData) : null
    }));
    
    socket.emit("load_history", formatted);
  });

  socket.on("send_message", async (data) => {
    // Сохраняем в БД с учетом кастомизации
    const savedMsg = await prisma.message.create({
      data: {
        content: data.content,
        imageUrl: data.imageUrl,
        type: data.type || 'text',
        author: data.author,
        userId: data.userId,
        channelId: data.channelId,
        dmRoom: data.dmRoom,
        userCustomData: data.userCustom ? JSON.stringify(data.userCustom) : null // SAVE CUSTOM DATA
      },
      include: { user: true, reactions: { include: { user: true } } }
    });

    const payload = {
        ...savedMsg,
        userCustom: data.userCustom // Send back immediately parsed
    };

    if (data.channelId) {
      io.to(`channel_${data.channelId}`).emit("receive_message", payload);
    } else if (data.dmRoom) {
      io.to(data.dmRoom).emit("receive_message", payload);
      // Also notify receiver globally (for unread badge in sidebar)
      // Logic omitted for brevity, simple emit works for DM room members
    }
  });

  socket.on("typing", ({ room }) => {
      socket.to(room).emit("user_typing", Object.keys(userSockets).find(key => userSockets[Number(key)] === socket.id));
  });
  
  socket.on("stop_typing", ({ room }) => {
      socket.to(room).emit("user_stop_typing", Object.keys(userSockets).find(key => userSockets[Number(key)] === socket.id));
  });

  // --- WEBRTC SIGNALING (VOICE/VIDEO) ---
  socket.on("join_voice_channel", async (channelId) => {
      const numericId = Number(channelId); // Ensure number
      if (!voiceRooms[numericId]) voiceRooms[numericId] = [];
      voiceRooms[numericId].push(socket.id);
      
      // Get User Details from DB to send to others
      const userIdStr = Object.keys(userSockets).find(key => userSockets[Number(key)] === socket.id);
      let userData: any = { socketId: socket.id, username: "Guest", avatar: "" };
      
      if (userIdStr) {
          const u = await prisma.user.findUnique({ where: { id: Number(userIdStr) }});
          if (u) userData = { socketId: socket.id, username: u.username, avatar: u.avatar };
      }

      // Notify others in this room
      const usersInRoom = voiceRooms[numericId];
      // Send List of ALL users in room to the new joiner
      socket.emit("all_users_in_voice", usersInRoom); 
      // Notify others that THIS user joined
      usersInRoom.forEach(id => {
          if (id !== socket.id) io.to(id).emit("user_joined_voice", { callerID: socket.id, signal: null }); // Signal handled by simple-peer initiation
      });

      // Send Voice State Update for Sidebar
      // We need to map socketIds to user info
      const fullUsers = [];
      for (const sid of usersInRoom) {
          const uidStr = Object.keys(userSockets).find(k => userSockets[Number(k)] === sid);
          if (uidStr) {
              const usr = await prisma.user.findUnique({ where: { id: Number(uidStr) }, select: { id: true, username: true, avatar: true } });
              if (usr) fullUsers.push({ ...usr, socketId: sid });
          }
      }
      io.emit("voice_room_update", { roomId: numericId, users: fullUsers });
  });

  socket.on("request_voice_states", async () => {
      // Send current state of all voice rooms to the requester
      for (const [roomId, sockets] of Object.entries(voiceRooms)) {
          const fullUsers = [];
          for (const sid of sockets) {
               const uidStr = Object.keys(userSockets).find(k => userSockets[Number(k)] === sid);
               if (uidStr) {
                   const usr = await prisma.user.findUnique({ where: { id: Number(uidStr) }, select: { id: true, username: true, avatar: true } });
                   if (usr) fullUsers.push({ ...usr, socketId: sid });
               }
          }
          socket.emit("voice_room_update", { roomId, users: fullUsers });
      }
  });

  socket.on("sending_signal", (payload) => {
    io.to(payload.userToSignal).emit("user_joined_voice", { signal: payload.signal, callerID: payload.callerID });
  });

  socket.on("returning_signal", (payload) => {
    io.to(payload.callerID).emit("receiving_returned_signal", { signal: payload.signal, id: socket.id });
  });

  socket.on("leave_voice_channel", () => {
      handleDisconnect(socket);
  });

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    handleDisconnect(socket);

    // Update DB status
    const userIdStr = Object.keys(userSockets).find(key => userSockets[Number(key)] === socket.id);
    if (userIdStr) {
        const userId = Number(userIdStr);
        await prisma.user.update({ where: { id: userId }, data: { status: "offline", lastSeen: new Date() } });
        io.emit("user_status_changed", { userId, status: "offline", lastSeen: new Date() });
        delete userSockets[userId];
    }
  });
});

async function handleDisconnect(socket: Socket) {
    for (const [roomId, users] of Object.entries(voiceRooms)) {
        const index = users.indexOf(socket.id);
        if (index !== -1) {
            users.splice(index, 1);
            const numRoomId = Number(roomId);
            
            // Notify others in the room
            users.forEach(id => io.to(id).emit("user_left_voice", socket.id));
            
            // Update sidebar for everyone
            const fullUsers = [];
            for (const sid of users) {
                 const uidStr = Object.keys(userSockets).find(k => userSockets[Number(k)] === sid);
                 if (uidStr) {
                     const usr = await prisma.user.findUnique({ where: { id: Number(uidStr) }, select: { id: true, username: true, avatar: true } });
                     if (usr) fullUsers.push({ ...usr, socketId: sid });
                 }
            }
            io.emit("voice_room_update", { roomId: numRoomId, users: fullUsers });
            
            if (users.length === 0) delete voiceRooms[numRoomId];
            break; 
        }
    }
}

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});