"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Hash,
  Send,
  Plus,
  MessageSquare,
  LogOut,
  Paperclip,
  UserPlus,
  Bell,
  Check,
  X,
  Settings,
  Trash2,
  Users,
  Volume2,
  Sliders,
} from "lucide-react";
import io, { Socket } from "socket.io-client";

// ===== CONFIG =====
const SOCKET_URL = "http://5.129.215.82:3001";

// ===== SOCKET SINGLETON =====
let _socket: Socket | null = null;
function getSocket() {
  if (!_socket) {
    _socket = io(SOCKET_URL, { transports: ["websocket"], withCredentials: true });
  }
  return _socket;
}

// ===== THEME STYLES =====
const THEME_STYLES = `
  :root[data-theme="minimal"] { --bg-primary: #ffffff; --bg-secondary: #f9fafb; --bg-tertiary: #f3f4f6; --text-primary: #111827; --text-secondary: #6b7280; --accent: #10b981; --border: #e5e7eb; --font-family: 'Segoe UI', sans-serif; }
  :root[data-theme="neon"] { --bg-primary: #0f172a; --bg-secondary: #1e293b; --bg-tertiary: #334155; --text-primary: #f8fafc; --text-secondary: #94a3b8; --accent: #38bdf8; --border: #1e293b; --font-family: 'Courier New', monospace; }
  :root[data-theme="vintage"] { --bg-primary: #fffbeb; --bg-secondary: #fef3c7; --bg-tertiary: #fde68a; --text-primary: #78350f; --text-secondary: #92400e; --accent: #d97706; --border: #fcd34d; --font-family: 'Georgia', serif; }
  body, div, input, textarea { transition: background-color 0.2s ease, color 0.2s ease; }
`;

type AuthMode = "login" | "register";

type User = {
  id: number;
  username: string;
  avatar?: string;
  status?: string;
  lastSeen?: string;
};

type ServerType = {
  id: number;
  name: string;
  icon?: string | null;
  description?: string | null;
  ownerId: number;
  channels?: ChannelType[];
};

type ChannelType = {
  id: number;
  name: string;
  type: "text" | "voice" | string;
};

type NotificationType = {
  id: number;
  type: string;
  status: string;
  sender?: User;
  server?: ServerType;
};

type MessageType = {
  id: number;
  content?: string | null;
  imageUrl?: string | null;
  type?: string;
  author: string;
  userId: number;
  channelId?: number | null;
  dmRoom?: string | null;
  createdAt: string;
  user?: User;
  reactions?: { id: number; emoji: string; user: User }[];
};

export default function EcoTalkApp() {
  const socket = useMemo(() => getSocket(), []);
  const [mounted, setMounted] = useState(false);

  // THEME
  const [theme, setTheme] = useState("minimal");
  useEffect(() => {
    const savedTheme = localStorage.getItem("eco_theme");
    if (savedTheme) setTheme(savedTheme);
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("eco_theme", theme);
  }, [theme]);

  // AUTH
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authInput, setAuthInput] = useState({ username: "", password: "" });

  // USER DATA
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const [myServers, setMyServers] = useState<ServerType[]>([]);
  const [myFriends, setMyFriends] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [currentServerMembers, setCurrentServerMembers] = useState<User[]>([]);

  // ACTIVE CONTEXT
  const [activeServerId, setActiveServerId] = useState<number | null>(null);
  const [activeServerData, setActiveServerData] = useState<ServerType | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [activeDM, setActiveDM] = useState<User | null>(null);
  const activeDMRef = useRef<User | null>(null);
  useEffect(() => {
    activeDMRef.current = activeDM;
  }, [activeDM]);

  // PANELS
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(true);

  // CHAT
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputText, setInputText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CREATE
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelType, setChannelType] = useState<"text" | "voice">("text");

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendName, setFriendName] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [inviteUserName, setInviteUserName] = useState("");

  // SETTINGS MODALS (ВАЖНО — это то, чего у тебя не было в JSX)
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [editServerName, setEditServerName] = useState("");
  const [editServerDesc, setEditServerDesc] = useState("");
  const [editServerIcon, setEditServerIcon] = useState("");
  const serverIconInputRef = useRef<HTMLInputElement>(null);

  const [editingChannel, setEditingChannel] = useState<ChannelType | null>(null);

  // ===== HELPERS =====
  const formatLastSeen = (d?: string) => {
    if (!d) return "Offline";
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    return hours < 24 ? `${hours}h ago` : new Date(d).toLocaleDateString();
  };

  const dmRoomName = (meId: number, friendId: number) => {
    const ids = [meId, friendId].sort((a, b) => a - b);
    return `dm_${ids[0]}_${ids[1]}`;
  };

  // ===== API =====
  const fetchUserData = async (t: string) => {
    const res = await fetch(`${SOCKET_URL}/api/me`, { headers: { Authorization: t } });
    if (!res.ok) return;
    const d = await res.json();
    setCurrentUser({ id: d.id, username: d.username, avatar: d.avatar, status: d.status, lastSeen: d.lastSeen });
    setMyServers(d.servers?.map((x: any) => x.server) || []);
    setMyFriends(d.friendsList || []);
    setNotifications(d.notifications || []);
    socket.emit("auth_user", d.id);
  };

  const handleAuth = async () => {
    const res = await fetch(`${SOCKET_URL}/api/auth/${authMode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authInput),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("eco_token", data.token);
      setToken(data.token);
      window.location.reload();
    } else {
      alert(data.error || "Auth error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("eco_token");
    window.location.reload();
  };

  // ===== SOCKET LISTENERS =====
  useEffect(() => {
    const onReceiveMessage = (msg: MessageType) => setMessages((p) => [...p, msg]);
    const onLoadHistory = (h: MessageType[]) => setMessages(h);
    const onNewNotif = (n: NotificationType) => setNotifications((p) => [n, ...p]);
    const onUserStatus = ({ userId, status, lastSeen }: any) => {
      setMyFriends((p) => p.map((f) => (f.id === userId ? { ...f, status, lastSeen } : f)));
      setCurrentServerMembers((p) => p.map((m) => (m.id === userId ? { ...m, status, lastSeen } : m)));
    };

    socket.on("receive_message", onReceiveMessage);
    socket.on("load_history", onLoadHistory);
    socket.on("new_notification", onNewNotif);
    socket.on("user_status_changed", onUserStatus);

    return () => {
      socket.off("receive_message", onReceiveMessage);
      socket.off("load_history", onLoadHistory);
      socket.off("new_notification", onNewNotif);
      socket.off("user_status_changed", onUserStatus);
    };
  }, [socket]);

  // ===== INIT =====
  useEffect(() => {
    setMounted(true);
    const storedToken = localStorage.getItem("eco_token");
    if (storedToken) {
      setToken(storedToken);
      fetchUserData(storedToken);
    }
  }, []);

  // ===== ACTIONS =====
  const selectServer = async (serverId: number) => {
    if (!tokenRef.current) return;
    setActiveServerId(serverId);
    setActiveDM(null);

    const res = await fetch(`${SOCKET_URL}/api/server/${serverId}`, {
      headers: { Authorization: tokenRef.current },
    });
    const data = await res.json();

    setActiveServerData(data);
    setCurrentServerMembers((data.members || []).map((m: any) => m.user));
    setMyServers((p) => p.map((s) => (s.id === serverId ? data : s)));

    const firstText = (data.channels || []).find((c: any) => c.type === "text");
    if (firstText) selectChannel(firstText);
    else if ((data.channels || []).length) selectChannel(data.channels[0]);
  };

  const selectChannel = (c: ChannelType) => {
    setActiveChannel(c);
    setMessages([]);

    if (c.type === "text") {
      socket.emit("join_channel", { channelId: c.id });
    } else {
      // voice тут можно добавить позже
      alert("Voice channel selected (voice part can be plugged in later).");
    }
  };

  const selectDM = (friend: User) => {
    if (!currentUserRef.current) return;
    if (friend.id === currentUserRef.current.id) return;

    setActiveServerId(null);
    setActiveServerData(null);
    setActiveChannel(null);

    setActiveDM(friend);
    setMessages([]);

    socket.emit("join_dm", { roomName: dmRoomName(currentUserRef.current.id, friend.id) });
  };

  const sendMessage = () => {
    const me = currentUserRef.current;
    if (!me || !inputText.trim()) return;

    socket.emit("send_message", {
      content: inputText,
      author: me.username,
      userId: me.id,
      channelId: activeServerId ? activeChannel?.id : null,
      dmRoom: activeDM ? dmRoomName(me.id, activeDM.id) : null,
      type: "text",
    });

    setInputText("");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserRef.current) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      socket.emit("send_message", {
        content: null,
        imageUrl: reader.result,
        type: "image",
        author: currentUserRef.current!.username,
        userId: currentUserRef.current!.id,
        channelId: activeServerId ? activeChannel?.id : null,
        dmRoom: activeDM ? dmRoomName(currentUserRef.current!.id, activeDM.id) : null,
      });
    };
    reader.readAsDataURL(file);
  };

  const createServer = async () => {
    if (!newServerName.trim() || !tokenRef.current) return;
    const res = await fetch(`${SOCKET_URL}/api/servers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: tokenRef.current },
      body: JSON.stringify({ name: newServerName }),
    });
    if (res.ok) {
      setNewServerName("");
      setShowCreateServer(false);
      fetchUserData(tokenRef.current);
    } else {
      alert("Failed to create server");
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim() || !activeServerId || !tokenRef.current) return;
    const res = await fetch(`${SOCKET_URL}/api/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: tokenRef.current },
      body: JSON.stringify({ name: newChannelName, serverId: activeServerId, type: channelType }),
    });
    if (res.ok) {
      setNewChannelName("");
      setShowCreateChannel(false);
      selectServer(activeServerId);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Failed");
    }
  };

  const addFriend = async () => {
    if (!tokenRef.current || !friendName.trim()) return;
    const res = await fetch(`${SOCKET_URL}/api/friends/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: tokenRef.current },
      body: JSON.stringify({ username: friendName }),
    });
    if (res.ok) {
      setFriendName("");
      setShowAddFriend(false);
      alert("Sent!");
    } else {
      alert("Error");
    }
  };

  const inviteUser = async () => {
    if (!tokenRef.current || !activeServerId || !inviteUserName.trim()) return;
    const res = await fetch(`${SOCKET_URL}/api/servers/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: tokenRef.current },
      body: JSON.stringify({ serverId: activeServerId, username: inviteUserName }),
    });
    if (res.ok) {
      alert("Sent!");
      setInviteUserName("");
      setShowInvite(false);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Invite error");
    }
  };

  // ===== SETTINGS (ТОЧНО РАБОТАЮТ) =====
  const openServerSettings = () => {
    if (!activeServerData) return;
    setEditServerName(activeServerData.name || "");
    setEditServerDesc(activeServerData.description || "");
    setEditServerIcon(activeServerData.icon || "");
    setShowServerSettings(true);
  };

  const updateServer = async () => {
    if (!activeServerId || !tokenRef.current) return;
    const payload = { name: editServerName, description: editServerDesc, icon: editServerIcon };
    const res = await fetch(`${SOCKET_URL}/api/server/${activeServerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: tokenRef.current },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowServerSettings(false);
      setMyServers((prev) => prev.map((s) => (s.id === activeServerId ? { ...s, ...payload } : s)));
      setActiveServerData((prev) => (prev ? { ...prev, ...payload } : prev));
    } else {
      alert("Update failed");
    }
  };

  const deleteServer = async () => {
    if (!activeServerId || !tokenRef.current) return;
    if (!confirm("Delete server?")) return;
    const res = await fetch(`${SOCKET_URL}/api/server/${activeServerId}`, {
      method: "DELETE",
      headers: { Authorization: tokenRef.current },
    });
    if (res.ok) {
      setShowServerSettings(false);
      setActiveServerId(null);
      setActiveServerData(null);
      setActiveChannel(null);
      setMessages([]);
      fetchUserData(tokenRef.current);
    } else {
      alert("Delete failed");
    }
  };

  const openChannelSettings = (e: React.MouseEvent, channel: ChannelType) => {
    e.stopPropagation();
    setEditingChannel(channel);
    setNewChannelName(channel.name);
  };

  const updateChannel = async () => {
    if (!editingChannel || !tokenRef.current) return;
    const res = await fetch(`${SOCKET_URL}/api/channels/${editingChannel.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: tokenRef.current },
      body: JSON.stringify({ name: newChannelName }),
    });
    if (res.ok && activeServerId) {
      setEditingChannel(null);
      selectServer(activeServerId);
    } else {
      alert("Channel update failed");
    }
  };

  const deleteChannel = async () => {
    if (!editingChannel || !tokenRef.current) return;
    if (!confirm("Delete channel?")) return;
    const res = await fetch(`${SOCKET_URL}/api/channels/${editingChannel.id}`, {
      method: "DELETE",
      headers: { Authorization: tokenRef.current },
    });
    if (res.ok && activeServerId) {
      if (activeChannel?.id === editingChannel.id) setActiveChannel(null);
      setEditingChannel(null);
      selectServer(activeServerId);
    } else {
      alert("Channel delete failed");
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>, isUser: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (!isUser) setEditServerIcon(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleNotification = async (id: number, action: "ACCEPT" | "DECLINE") => {
    if (!tokenRef.current) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch(`${SOCKET_URL}/api/notifications/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: tokenRef.current },
      body: JSON.stringify({ notificationId: id, action }),
    });
    if (action === "ACCEPT") fetchUserData(tokenRef.current);
  };

  // ===== RENDER =====
  if (!mounted) return <div className="h-screen flex items-center justify-center font-bold">Loading...</div>;

  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 notranslate">
        <style>{THEME_STYLES}</style>

        <div className="bg-white p-8 rounded-xl shadow-xl w-96">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">
            {authMode === "login" ? "Login" : "Register"}
          </h1>

          <input
            className="w-full p-2 border rounded mb-2"
            placeholder="Username"
            value={authInput.username}
            onChange={(e) => setAuthInput({ ...authInput, username: e.target.value })}
          />
          <input
            className="w-full p-2 border rounded mb-4"
            type="password"
            placeholder="Password"
            value={authInput.password}
            onChange={(e) => setAuthInput({ ...authInput, password: e.target.value })}
          />

          <button onClick={handleAuth} className="w-full bg-green-600 text-white p-2 rounded font-bold">
            {authMode === "login" ? "Login" : "Register"}
          </button>

          <p
            className="text-center mt-2 cursor-pointer text-sm text-gray-600"
            onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
          >
            {authMode === "login" ? "Need account?" : "Have account?"}
          </p>
        </div>
      </div>
    );
  }

  const activeFriendData = myFriends.find((f) => f.id === activeDM?.id);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-[var(--font-family)] notranslate">
      <style>{THEME_STYLES}</style>

      <div className="flex w-full h-full">
        {/* SIDEBAR */}
        <div className="w-18 bg-gray-900 flex flex-col items-center py-4 space-y-3 z-20 text-white">
          <div
            onClick={() => {
              setActiveServerId(null);
              setActiveServerData(null);
              setActiveChannel(null);
              setActiveDM(null);
              setMessages([]);
            }}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer ${
              activeServerId === null ? "bg-indigo-500 text-white" : "bg-gray-700 text-gray-200 hover:bg-green-600"
            }`}
          >
            <MessageSquare size={24} />
          </div>

          <div className="w-8 h-0.5 bg-gray-700 rounded"></div>

          {myServers.map((s) => (
            <div
              key={s.id}
              onClick={() => selectServer(s.id)}
              className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer font-bold overflow-hidden ${
                activeServerId === s.id ? "rounded-xl bg-green-500 text-white" : "bg-gray-700 text-gray-200"
              }`}
              title={s.name}
            >
              {s.icon && s.icon.startsWith("data:") ? <img src={s.icon} className="w-full h-full object-cover" /> : s.name?.[0]}
            </div>
          ))}

          <div onClick={() => setShowCreateServer(true)} className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-green-400 cursor-pointer">
            <Plus size={24} />
          </div>
        </div>

        {/* CHANNEL LIST */}
        <div className="w-60 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col transition-colors relative">
          <div className="h-12 border-b border-[var(--border)] flex items-center px-4 font-bold justify-between relative">
            <div className="truncate w-32">
              {activeServerId ? myServers.find((s) => s.id === activeServerId)?.name : "Direct Messages"}
            </div>

            <div className="flex gap-2 items-center">
              {/* ⚙️ ВАЖНО: теперь реально открывает модалку ниже */}
              {activeServerId && activeServerData?.ownerId === currentUser?.id && (
                <Settings size={16} className="cursor-pointer hover:text-[var(--accent)]" onClick={openServerSettings} />
              )}

              {!activeServerId && (
                <div className="text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer" onClick={() => setShowAddFriend(true)}>
                  <Plus size={18} />
                </div>
              )}

              {activeServerId && (
                <UserPlus size={18} className="cursor-pointer hover:text-[var(--accent)]" onClick={() => setShowInvite(true)} />
              )}

              <div className="relative" onClick={() => setShowNotifPanel((p) => !p)}>
                <Bell
                  size={18}
                  className={`cursor-pointer ${notifications.length > 0 ? "text-[var(--accent)] animate-pulse" : "text-[var(--text-secondary)]"}`}
                />
                {notifications.length > 0 && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />}
              </div>
            </div>

            {showNotifPanel && (
              <div className="absolute top-12 right-2 w-64 bg-[var(--bg-primary)] border border-[var(--border)] shadow-xl rounded-xl z-50 max-h-80 overflow-y-auto">
                <div className="p-2 text-xs font-bold text-[var(--text-secondary)] border-b border-[var(--border)]">NOTIFICATIONS</div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">No new notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-3 border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]">
                      <div className="text-sm mb-2">
                        <span className="font-bold">{n.sender?.username || "Someone"}</span> {n.type}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleNotification(n.id, "ACCEPT")}
                          className="flex-1 bg-green-500 text-white py-1 rounded text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <Check size={12} /> Accept
                        </button>
                        <button
                          onClick={() => handleNotification(n.id, "DECLINE")}
                          className="flex-1 bg-gray-200 text-gray-700 py-1 rounded text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <X size={12} /> Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex-1 p-2 overflow-y-auto pb-16">
            {activeServerId ? (
              <>
                <div className="flex justify-between px-2 mb-2 text-xs font-bold text-[var(--text-secondary)]">
                  <span>TEXT</span>
                  <Plus
                    size={14}
                    className="cursor-pointer"
                    onClick={() => {
                      setChannelType("text");
                      setShowCreateChannel(true);
                    }}
                  />
                </div>

                {(myServers.find((s) => s.id === activeServerId)?.channels || [])
                  .filter((c: any) => c.type === "text")
                  .map((c: any) => (
                    <div
                      key={c.id}
                      onClick={() => selectChannel(c)}
                      className={`group flex items-center justify-between px-2 py-1 rounded mb-1 cursor-pointer ${
                        activeChannel?.id === c.id ? "bg-[var(--bg-tertiary)] font-bold" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      <div className="flex items-center">
                        <Hash size={16} className="mr-1" /> {c.name}
                      </div>
                      {activeServerData?.ownerId === currentUser?.id && (
                        <Settings
                          size={12}
                          className="opacity-0 group-hover:opacity-100 hover:text-[var(--accent)]"
                          onClick={(e) => openChannelSettings(e, c)}
                        />
                      )}
                    </div>
                  ))}

                <div className="flex justify-between px-2 mb-2 mt-4 text-xs font-bold text-[var(--text-secondary)]">
                  <span>VOICE</span>
                  <Plus
                    size={14}
                    className="cursor-pointer"
                    onClick={() => {
                      setChannelType("voice");
                      setShowCreateChannel(true);
                    }}
                  />
                </div>

                {(myServers.find((s) => s.id === activeServerId)?.channels || [])
                  .filter((c: any) => c.type === "voice")
                  .map((c: any) => (
                    <div
                      key={c.id}
                      onClick={() => selectChannel(c)}
                      className={`group flex items-center justify-between px-2 py-1 rounded mb-1 cursor-pointer ${
                        activeChannel?.id === c.id ? "bg-[var(--bg-tertiary)] font-bold" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      <div className="flex items-center">
                        <Volume2 size={16} className="mr-1" /> {c.name}
                      </div>
                      {activeServerData?.ownerId === currentUser?.id && (
                        <Settings
                          size={12}
                          className="opacity-0 group-hover:opacity-100 hover:text-[var(--accent)]"
                          onClick={(e) => openChannelSettings(e, c)}
                        />
                      )}
                    </div>
                  ))}
              </>
            ) : (
              myFriends.map((f) => (
                <div
                  key={f.id}
                  onClick={() => selectDM(f)}
                  className={`flex items-center p-2 rounded cursor-pointer ${
                    activeDM?.id === f.id ? "bg-[var(--bg-tertiary)]" : ""
                  }`}
                >
                  <div className="relative w-8 h-8 flex-shrink-0 mr-2">
                    <img src={f.avatar} className="rounded-full w-full h-full object-cover" />
                    <div
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${
                        f.status === "online" ? "bg-green-500" : "bg-gray-400"
                      }`}
                    ></div>
                  </div>
                  <div className="flex-1">
                    <span className="block text-sm font-medium">{f.username}</span>
                    <span className="block text-[10px] text-[var(--text-secondary)]">
                      {f.status === "online" ? "Online" : `Last seen: ${formatLastSeen(f.lastSeen)}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* USER BAR */}
          <div className="p-2 border-t border-[var(--border)] flex items-center bg-[var(--bg-tertiary)]">
            <img src={currentUser?.avatar} className="w-8 h-8 rounded-full mr-2" />
            <div className="font-bold text-sm">{currentUser?.username}</div>

            <button
              className="ml-auto mr-2 p-2 rounded-lg hover:bg-[var(--border)]"
              onClick={() => setTheme((p) => (p === "minimal" ? "neon" : p === "neon" ? "vintage" : "minimal"))}
              title="Switch Theme"
            >
              <Sliders size={16} />
            </button>

            <LogOut size={16} className="cursor-pointer text-red-500" onClick={handleLogout} />
          </div>
        </div>

        {/* MAIN AREA */}
        <div className="flex-1 flex flex-col bg-[var(--bg-primary)] min-w-0 relative transition-colors">
          <div className="h-12 border-b border-[var(--border)] flex items-center justify-between px-4 shadow-sm">
            <div className="font-bold flex items-center">
              {activeServerId ? (
                <>
                  <Hash className="mr-2" /> {activeChannel?.name || "Select channel"}
                </>
              ) : (
                <>
                  <div className="flex flex-col">
                    <span>{activeDM?.username || "Select Friend"}</span>
                    {activeDM && (
                      <span className={`text-[10px] font-normal ${activeFriendData?.status === "online" ? "text-green-600" : "text-gray-400"}`}>
                        {activeFriendData?.status === "online" ? "Online" : `Last seen: ${formatLastSeen(activeFriendData?.lastSeen)}`}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {activeServerId && (
                <Users
                  className={`cursor-pointer ${showMembersPanel ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}
                  onClick={() => setShowMembersPanel((p) => !p)}
                />
              )}
            </div>
          </div>

          {/* CHAT */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="hover:bg-[var(--bg-secondary)] p-2 rounded">
                <div className="flex items-start">
                  <div className="w-10 h-10 mr-3 mt-1">
                    <img src={m.user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.userId}`} className="w-10 h-10 rounded-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-sm">{m.author}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {m.content && <div className="text-sm whitespace-pre-wrap">{m.content}</div>}
                    {m.imageUrl && <img src={m.imageUrl} className="mt-2 rounded-lg max-w-sm" />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* INPUT */}
          <div className="p-4">
            <div className="border border-[var(--border)] rounded-lg flex items-center p-2 bg-[var(--bg-tertiary)]">
              <input type="file" ref={fileInputRef} hidden onChange={handleFile} />
              <input
                type="text"
                className="flex-1 outline-none bg-transparent"
                placeholder="Message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <Paperclip size={20} className="text-[var(--text-secondary)] cursor-pointer mr-2" onClick={() => fileInputRef.current?.click()} />
              <Send size={20} className="cursor-pointer text-[var(--text-secondary)]" onClick={sendMessage} />
            </div>
          </div>
        </div>

        {/* MEMBERS PANEL */}
        {activeServerId && showMembersPanel && (
          <div className="w-60 bg-[var(--bg-secondary)] border-l border-[var(--border)] p-3 overflow-y-auto">
            <div className="font-black text-xs text-[var(--text-secondary)] mb-2">MEMBERS</div>
            {currentServerMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-2 p-2 rounded hover:bg-[var(--bg-tertiary)]">
                <img src={m.avatar} className="w-8 h-8 rounded-full object-cover" />
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{m.username}</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">
                    {m.status === "online" ? "Online" : `Last seen: ${formatLastSeen(m.lastSeen)}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== MODALS ===== */}

        {/* CREATE SERVER */}
        {showCreateServer && (
          <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowCreateServer(false)}>
            <div className="w-full max-w-md bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="font-black flex items-center gap-2"><Plus size={18}/> Create Server</div>
                <button className="p-2 rounded-full hover:bg-[var(--bg-tertiary)]" onClick={() => setShowCreateServer(false)}><X size={18}/></button>
              </div>
              <div className="p-4 space-y-3">
                <input className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] outline-none" value={newServerName} onChange={(e)=>setNewServerName(e.target.value)} placeholder="Server name"/>
                <button className="w-full py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700" onClick={createServer}>Create</button>
              </div>
            </div>
          </div>
        )}

        {/* CREATE CHANNEL */}
        {showCreateChannel && (
          <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowCreateChannel(false)}>
            <div className="w-full max-w-md bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="font-black flex items-center gap-2"><Plus size={18}/> Create Channel</div>
                <button className="p-2 rounded-full hover:bg-[var(--bg-tertiary)]" onClick={() => setShowCreateChannel(false)}><X size={18}/></button>
              </div>
              <div className="p-4 space-y-3">
                <input className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] outline-none" value={newChannelName} onChange={(e)=>setNewChannelName(e.target.value)} placeholder="Channel name"/>
                <div className="flex gap-2">
                  <button className={`flex-1 py-2 rounded-lg font-bold ${channelType==="text" ? "bg-green-600 text-white" : "bg-[var(--bg-tertiary)]"}`} onClick={()=>setChannelType("text")}>Text</button>
                  <button className={`flex-1 py-2 rounded-lg font-bold ${channelType==="voice" ? "bg-green-600 text-white" : "bg-[var(--bg-tertiary)]"}`} onClick={()=>setChannelType("voice")}>Voice</button>
                </div>
                <button className="w-full py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700" onClick={createChannel}>Create</button>
              </div>
            </div>
          </div>
        )}

        {/* ADD FRIEND */}
        {showAddFriend && (
          <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowAddFriend(false)}>
            <div className="w-full max-w-md bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="font-black flex items-center gap-2"><UserPlus size={18}/> Add Friend</div>
                <button className="p-2 rounded-full hover:bg-[var(--bg-tertiary)]" onClick={() => setShowAddFriend(false)}><X size={18}/></button>
              </div>
              <div className="p-4 space-y-3">
                <input className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] outline-none" value={friendName} onChange={(e)=>setFriendName(e.target.value)} placeholder="Friend username"/>
                <button className="w-full py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700" onClick={addFriend}>Send request</button>
              </div>
            </div>
          </div>
        )}

        {/* INVITE USER */}
        {showInvite && (
          <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
            <div className="w-full max-w-md bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="font-black flex items-center gap-2"><UserPlus size={18}/> Invite to Server</div>
                <button className="p-2 rounded-full hover:bg-[var(--bg-tertiary)]" onClick={() => setShowInvite(false)}><X size={18}/></button>
              </div>
              <div className="p-4 space-y-3">
                <input className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] outline-none" value={inviteUserName} onChange={(e)=>setInviteUserName(e.target.value)} placeholder="Username"/>
                <button className="w-full py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700" onClick={inviteUser}>Invite</button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ SERVER SETTINGS MODAL (то, что чинило “⚙️ не работает”) */}
        {showServerSettings && (
          <div className="fixed inset-0 z-[140] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowServerSettings(false)}>
            <div className="w-full max-w-lg bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="font-black text-lg flex items-center gap-2"><Settings size={18}/> Server Settings</div>
                <button className="p-2 rounded-full hover:bg-[var(--bg-tertiary)]" onClick={() => setShowServerSettings(false)}><X size={18}/></button>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <div className="text-xs font-bold text-[var(--text-secondary)] mb-1">NAME</div>
                  <input
                    className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] outline-none"
                    value={editServerName}
                    onChange={(e) => setEditServerName(e.target.value)}
                    placeholder="Server name"
                  />
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--text-secondary)] mb-1">DESCRIPTION</div>
                  <textarea
                    className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] outline-none min-h-[90px]"
                    value={editServerDesc}
                    onChange={(e) => setEditServerDesc(e.target.value)}
                    placeholder="Server description"
                  />
                </div>

                <div>
                  <div className="text-xs font-bold text-[var(--text-secondary)] mb-1">ICON</div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center">
                      {editServerIcon ? <img src={editServerIcon} className="w-full h-full object-cover" /> : <span className="text-xs text-[var(--text-secondary)]">No</span>}
                    </div>

                    <input
                      className="flex-1 p-2 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] outline-none"
                      value={editServerIcon}
                      onChange={(e) => setEditServerIcon(e.target.value)}
                      placeholder="Paste image URL / base64"
                    />

                    <input
                      type="file"
                      ref={serverIconInputRef}
                      hidden
                      accept="image/*"
                      onChange={(e) => handleAvatarUpload(e, false)}
                    />
                    <button
                      className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--border)] font-bold text-sm"
                      onClick={() => serverIconInputRef.current?.click()}
                    >
                      Upload
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 flex items-center gap-2" onClick={deleteServer}>
                  <Trash2 size={16} /> Delete
                </button>

                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--border)] font-bold" onClick={() => setShowServerSettings(false)}>
                    Cancel
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700" onClick={updateServer}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ CHANNEL SETTINGS MODAL */}
        {editingChannel && (
          <div className="fixed inset-0 z-[140] bg-black/70 flex items-center justify-center p-4" onClick={() => setEditingChannel(null)}>
            <div className="w-full max-w-md bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="font-black text-lg flex items-center gap-2"><Sliders size={18}/> Channel Settings</div>
                <button className="p-2 rounded-full hover:bg-[var(--bg-tertiary)]" onClick={() => setEditingChannel(null)}><X size={18}/></button>
              </div>

              <div className="p-4 space-y-3">
                <div className="text-xs font-bold text-[var(--text-secondary)]">NAME</div>
                <input
                  className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] outline-none"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                />
              </div>

              <div className="p-4 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 flex items-center gap-2" onClick={deleteChannel}>
                  <Trash2 size={16} /> Delete
                </button>

                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--border)] font-bold" onClick={() => setEditingChannel(null)}>
                    Cancel
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700" onClick={updateChannel}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
