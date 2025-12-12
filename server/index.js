const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: '50mb' }));

const prisma = new PrismaClient();
const server = http.createServer(app);
const SECRET_KEY = "eco-secret-key";

const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e8 });

// ХРАНИЛИЩА
const rooms = {}; 
const socketToRoom = {};

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const broadcastRoomUsers = async (roomId) => {
  if (!roomId || !rooms[roomId]) return;
  const users = [];
  const uniqueUsers = new Map();
  for (const p of rooms[roomId]) {
    if (!uniqueUsers.has(p.userId)) {
      const u = await prisma.user.findUnique({ where: { id: p.userId } });
      if (u) { uniqueUsers.set(p.userId, true); users.push({ id: u.id, username: u.username, avatar: u.avatar, socketId: p.socketId }); }
    }
  }
  io.emit('voice_room_update', { roomId, users });
};

// --- AUTH API ---
app.post('/api/auth/register', async (req, res) => { 
  const { username, password } = req.body; 
  try { 
    const existing = await prisma.user.findUnique({ where: { username } }); 
    if (existing) return res.status(400).json({ error: "Taken" }); 
    const hashedPassword = await bcrypt.hash(password, 10); 
    const user = await prisma.user.create({ 
      data: { 
        username, 
        password: hashedPassword, 
        status: "online", 
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, 
        servers: { create: { server: { create: { name: "Home Base", ownerId: 1, channels: { create: { name: "general" } } } } } } 
      } 
    }); 
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY); 
    res.json({ token, user }); 
  } catch (e) { res.status(500).json({ error: "Error" }); } 
});

app.post('/api/auth/login', async (req, res) => { 
  const { username, password } = req.body; 
  try { 
    const user = await prisma.user.findUnique({ where: { username } }); 
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({ error: "Invalid" }); 
    await prisma.user.update({ where: { id: user.id }, data: { status: 'online' } }); 
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY); 
    res.json({ token, user }); 
  } catch (e) { res.status(500).json({ error: "Error" }); } 
});

app.get('/api/me', authenticateToken, async (req, res) => { 
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { servers: { include: { server: true } } } }); 
  const friendsIds = JSON.parse(user.friendsData || "[]"); 
  const friends = await prisma.user.findMany({ where: { id: { in: friendsIds } } }); 
  const notifications = await prisma.notification.findMany({ where: { receiverId: req.user.id, status: "PENDING" }, include: { sender: true, server: true }, orderBy: { createdAt: 'desc' } }); 
  res.json({ ...user, friendsList: friends, notifications }); 
});

app.put('/api/me', authenticateToken, async (req, res) => { try { const updated = await prisma.user.update({ where: { id: req.user.id }, data: req.body }); res.json(updated); } catch (e) { res.status(500).json({ error: "Error" }); } });

// --- SERVER API ---
app.post('/api/servers', authenticateToken, async (req, res) => { 
  const s = await prisma.server.create({ 
    data: { 
      name: req.body.name, 
      ownerId: req.user.id, 
      icon: req.body.name[0].toUpperCase(), 
      channels: { create: [{ name: "general", type: "text" }, { name: "Voice Lounge", type: "voice" }] }, 
      members: { create: { userId: req.user.id } } 
    } 
  }); 
  res.json(s); 
});

app.get('/api/server/:id', authenticateToken, async (req, res) => { 
  const s = await prisma.server.findUnique({ where: { id: parseInt(req.params.id) }, include: { channels: true, members: { include: { user: true } } } }); 
  res.json(s); 
});

app.put('/api/server/:id', authenticateToken, async (req, res) => { 
  await prisma.server.update({ where: { id: parseInt(req.params.id) }, data: req.body }); 
  res.json({ success: true }); 
});

app.delete('/api/server/:id', authenticateToken, async (req, res) => { 
  const id = parseInt(req.params.id); 
  try {
    await prisma.message.deleteMany({ where: { channel: { serverId: id } } }); 
    await prisma.channel.deleteMany({ where: { serverId: id } }); 
    await prisma.member.deleteMany({ where: { serverId: id } }); 
    await prisma.notification.deleteMany({ where: { serverId: id } }); 
    await prisma.server.delete({ where: { id } }); 
    res.json({ success: true }); 
  } catch(e) { res.status(500).json({error: "Error deleting server"}); }
});

// --- CHANNEL API (ИСПРАВЛЕНО) ---
app.post('/api/channels', authenticateToken, async (req, res) => { 
  try {
    const { name, type, serverId } = req.body;
    
    // Проверка данных
    if (!name || !serverId) {
        return res.status(400).json({ error: "Missing name or serverId" });
    }

    const channel = await prisma.channel.create({ 
      data: {
        name,
        type: type || "text",
        serverId: parseInt(serverId) // Обязательно преобразуем в число
      } 
    }); 
    
    res.json(channel); 
  } catch(e) {
    console.error("Create channel error:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put('/api/channels/:id', authenticateToken, async (req, res) => { 
  await prisma.channel.update({ where: { id: parseInt(req.params.id) }, data: { name: req.body.name } }); 
  res.json({ success: true }); 
});

app.delete('/api/channels/:id', authenticateToken, async (req, res) => { 
  try { 
    await prisma.message.deleteMany({ where: { channelId: parseInt(req.params.id) } }); 
    await prisma.channel.delete({ where: { id: parseInt(req.params.id) } }); 
    res.json({ success: true }); 
  } catch(e) { res.status(500).json({error: "Error"}); } 
});

// --- MESSAGES ---
app.put('/api/messages/:id', authenticateToken, async (req, res) => {
  const { content } = req.body;
  const msg = await prisma.message.update({ where: { id: parseInt(req.params.id) }, data: { content, isEdited: true }, include: { user: true, reactions: { include: { user: true } } } });
  const room = msg.channelId ? `channel_${msg.channelId}` : msg.dmRoom;
  io.to(room).emit('message_updated', msg);
  res.json(msg);
});

app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
  const msg = await prisma.message.findUnique({ where: { id: parseInt(req.params.id) } });
  if(msg) {
    await prisma.message.delete({ where: { id: parseInt(req.params.id) } });
    const room = msg.channelId ? `channel_${msg.channelId}` : msg.dmRoom;
    io.to(room).emit('message_deleted', msg.id);
  }
  res.json({ success: true });
});

app.post('/api/messages/:id/react', authenticateToken, async (req, res) => {
  const { emoji } = req.body;
  const messageId = parseInt(req.params.id);
  const userId = req.user.id;
  const existing = await prisma.reaction.findFirst({ where: { messageId, userId, emoji } });
  if (existing) { await prisma.reaction.delete({ where: { id: existing.id } }); } else { await prisma.reaction.create({ data: { messageId, userId, emoji } }); }
  const updatedMsg = await prisma.message.findUnique({ where: { id: messageId }, include: { user: true, reactions: { include: { user: true } } } });
  const room = updatedMsg.channelId ? `channel_${updatedMsg.channelId}` : updatedMsg.dmRoom;
  io.to(room).emit('message_updated', updatedMsg);
  res.json(updatedMsg);
});

// --- SOCIAL ---
app.post('/api/servers/invite', authenticateToken, async (req, res) => { const u = await prisma.user.findUnique({ where: { username: req.body.username } }); if (!u) return res.status(404).json({ error: "Not found" }); const n = await prisma.notification.create({ data: { type: "SERVER_INVITE", senderId: req.user.id, receiverId: u.id, serverId: req.body.serverId }, include: { sender: true, server: true } }); io.to(`user_${u.id}`).emit('new_notification', n); res.json({ success: true }); });
app.post('/api/friends/invite', authenticateToken, async (req, res) => { const u = await prisma.user.findUnique({ where: { username: req.body.username } }); if (!u) return res.status(404).json({ error: "Not found" }); const n = await prisma.notification.create({ data: { type: "FRIEND_REQUEST", senderId: req.user.id, receiverId: u.id }, include: { sender: true } }); io.to(`user_${u.id}`).emit('new_notification', n); res.json({ success: true }); });
app.post('/api/notifications/respond', authenticateToken, async (req, res) => { const { notificationId, action } = req.body; const n = await prisma.notification.findUnique({ where: { id: notificationId } }); await prisma.notification.update({ where: { id: notificationId }, data: { status: action === "ACCEPT" ? "ACCEPTED" : "DECLINED" } }); if (action === "ACCEPT") { if (n.type === "FRIEND_REQUEST") { const u1 = await prisma.user.findUnique({ where: { id: n.senderId } }); const u2 = await prisma.user.findUnique({ where: { id: n.receiverId } }); let f1 = JSON.parse(u1.friendsData || "[]"); if(!f1.includes(u2.id)) f1.push(u2.id); let f2 = JSON.parse(u2.friendsData || "[]"); if(!f2.includes(u1.id)) f2.push(u1.id); await prisma.user.update({ where: { id: u1.id }, data: { friendsData: JSON.stringify(f1) } }); await prisma.user.update({ where: { id: u2.id }, data: { friendsData: JSON.stringify(f2) } }); io.to(`user_${u1.id}`).emit('friend_added', u2); io.to(`user_${u2.id}`).emit('friend_added', u1); } else if (n.type === "SERVER_INVITE") { await prisma.member.create({ data: { userId: n.receiverId, serverId: n.serverId } }); } } res.json({ success: true }); });
app.delete('/api/friends/:id', authenticateToken, async (req, res) => { const fid = parseInt(req.params.id); const me = await prisma.user.findUnique({ where: { id: req.user.id } }); let f1 = JSON.parse(me.friendsData || "[]").filter(id => id !== fid); await prisma.user.update({ where: { id: req.user.id }, data: { friendsData: JSON.stringify(f1) } }); const fr = await prisma.user.findUnique({ where: { id: fid } }); if(fr) { let f2 = JSON.parse(fr.friendsData || "[]").filter(id => id !== req.user.id); await prisma.user.update({ where: { id: fid }, data: { friendsData: JSON.stringify(f2) } }); io.to(`user_${fid}`).emit('friend_removed', req.user.id); } res.json({ success: true }); });
app.delete('/api/server/:serverId/kick/:userId', authenticateToken, async (req, res) => { await prisma.member.deleteMany({ where: { serverId: parseInt(req.params.serverId), userId: parseInt(req.params.userId) } }); res.json({ success: true }); });

// --- SOCKET.IO ---
io.on('connection', (socket) => {
  socket.on('auth_user', async (userId) => { socket.userId = userId; socket.join(`user_${userId}`); await prisma.user.update({ where: { id: userId }, data: { status: 'online' } }); io.emit('user_status_changed', { userId, status: 'online' }); Object.keys(rooms).forEach(roomId => broadcastRoomUsers(roomId)); });
  const leaveRoom = () => { const r = socketToRoom[socket.id]; if(r && rooms[r]) { rooms[r] = rooms[r].filter(p => p.socketId !== socket.id); rooms[r].forEach(p => io.to(p.socketId).emit('user_left_voice', socket.id)); if(rooms[r].length === 0) { delete rooms[r]; io.emit('voice_room_update', { roomId: r, users: [] }); } else { broadcastRoomUsers(r); } delete socketToRoom[socket.id]; } };
  socket.on('disconnect', () => { leaveRoom(); if(socket.userId) { prisma.user.update({ where: { id: socket.userId }, data: { status: 'offline', lastSeen: new Date() } }).catch(()=>{}); io.emit('user_status_changed', { userId: socket.userId, status: 'offline', lastSeen: new Date() }); } });
  socket.on('leave_voice_channel', leaveRoom);
  socket.on('request_voice_states', () => { Object.keys(rooms).forEach(roomId => broadcastRoomUsers(roomId)); });
  socket.on('join_channel', async ({ channelId }) => { socket.join(`channel_${channelId}`); const h = await prisma.message.findMany({ where: { channelId }, take: 50, include: { user: true, reactions: { include: { user: true } } }, orderBy: { createdAt: 'asc' } }); socket.emit('load_history', h); });
  socket.on('join_dm', async ({ roomName }) => { socket.join(roomName); const h = await prisma.message.findMany({ where: { dmRoom: roomName }, take: 50, include: { user: true, reactions: { include: { user: true } } }, orderBy: { createdAt: 'asc' } }); socket.emit('load_history', h); });
  socket.on('send_message', async (data) => { const { content, imageUrl, author, userId, channelId, dmRoom, type } = data; const m = await prisma.message.create({ data: { content, imageUrl, author, userId, channelId, dmRoom, type: type || "text" }, include: { user: true, reactions: { include: { user: true } } } }); const room = channelId ? `channel_${channelId}` : dmRoom; if(room) io.to(room).emit('receive_message', m); });
  socket.on('typing', ({ room }) => socket.to(room).emit('user_typing', socket.userId));
  socket.on('stop_typing', ({ room }) => socket.to(room).emit('user_stop_typing', socket.userId));
  
  socket.on("join_voice_channel", (rawRoomID) => {
    const roomId = String(rawRoomID);
    if (socketToRoom[socket.id] === roomId) return;
    if (socketToRoom[socket.id]) leaveRoom();
    if (!rooms[roomId]) rooms[roomId] = [];
    if (rooms[roomId].find(p => p.userId === socket.userId)) rooms[roomId] = rooms[roomId].filter(p => p.userId !== socket.userId);
    rooms[roomId].push({ socketId: socket.id, userId: socket.userId });
    socketToRoom[socket.id] = roomId;
    const others = rooms[roomId].filter(p => p.socketId !== socket.id).map(p => p.socketId);
    socket.emit("all_users_in_voice", others);
    broadcastRoomUsers(roomId);
  });
  socket.on("sending_signal", p => io.to(p.userToSignal).emit('user_joined_voice', { signal: p.signal, callerID: p.callerID }));
  socket.on("returning_signal", p => io.to(p.callerID).emit('receiving_returned_signal', { signal: p.signal, id: socket.id }));
});

server.listen(3001, () => { console.log('✅ SERVER READY'); });