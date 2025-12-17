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
            if (u) { 
                uniqueUsers.set(p.userId, true); 
                users.push({ id: u.id, username: u.username, avatar: u.avatar, socketId: p.socketId }); 
            }
        }
    }
    io.emit('voice_room_update', { roomId, users });
};

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
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
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
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Invalid" });
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

app.post('/api/channels', authenticateToken, async (req, res) => {
    try {
        const { name, type, serverId } = req.body;
        const channel = await prisma.channel.create({
            data: { name, type: type || "text", serverId: parseInt(serverId) }
        });
        res.json(channel);
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

io.on('connection', (socket) => {
    socket.on('auth_user', async (userId) => {
        socket.userId = userId;
        socket.join(`user_${userId}`);
        await prisma.user.update({ where: { id: userId }, data: { status: 'online' } });
        io.emit('user_status_changed', { userId, status: 'online' });
    });

    const leaveRoom = () => {
        const r = socketToRoom[socket.id];
        if (r && rooms[r]) {
            rooms[r] = rooms[r].filter(p => p.socketId !== socket.id);
            if (rooms[r].length === 0) delete rooms[r];
            else broadcastRoomUsers(r);
            delete socketToRoom[socket.id];
        }
    };

    socket.on('disconnect', () => {
        leaveRoom();
        if (socket.userId) {
            prisma.user.update({ where: { id: socket.userId }, data: { status: 'offline', lastSeen: new Date() } }).catch(() => {});
            io.emit('user_status_changed', { userId: socket.userId, status: 'offline' });
        }
    });

    socket.on('join_voice_channel', (roomId) => {
        if (socketToRoom[socket.id]) leaveRoom();
        if (!rooms[roomId]) rooms[roomId] = [];
        rooms[roomId].push({ socketId: socket.id, userId: socket.userId });
        socketToRoom[socket.id] = roomId;
        const others = rooms[roomId].filter(p => p.socketId !== socket.id).map(p => p.socketId);
        socket.emit("all_users_in_voice", others);
        broadcastRoomUsers(roomId);
    });

    socket.on('send_message', async (data) => {
        const { content, imageUrl, author, userId, channelId, dmRoom, type } = data;
        const m = await prisma.message.create({
            data: { content, imageUrl, author, userId, channelId, dmRoom, type: type || "text" },
            include: { user: true, reactions: { include: { user: true } } }
        });
        const room = channelId ? `channel_${channelId}` : dmRoom;
        if (room) io.to(room).emit('receive_message', m);
    });
});

server.listen(3001, () => { console.log('✅ SERVER READY ON 3001'); });