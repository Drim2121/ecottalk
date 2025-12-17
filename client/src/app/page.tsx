"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Hash, Send, Plus, MessageSquare, LogOut, Paperclip, UserPlus, PhoneOff, Bell,
  Check, X, Settings, Trash2, UserMinus, Users, Volume2, Mic, MicOff, Smile, Edit2,
  Palette, Zap, ZapOff, Video, VideoOff, Monitor, MonitorOff
} from "lucide-react";
import io, { Socket } from "socket.io-client";
import Peer from "simple-peer";

// ===== CONSTANTS & SOUNDS =====
const SOCKET_URL = "http://5.129.215.82:3001";
const SFX = {
  msg: "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.m4a", // Message Pop
  join: "https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.m4a", // Join Tech
  leave: "https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.m4a", // Leave Tech
  click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.m4a", // Soft Click
  call: "https://assets.mixkit.co/active_storage/sfx/1362/1362-preview.m4a"   // Ringtone (optional)
};

// ===== THEMES CSS =====
const THEME_STYLES = `
  :root[data-theme="minimal"] { --bg-primary: #ffffff; --bg-secondary: #f9fafb; --bg-tertiary: #f3f4f6; --text-primary: #111827; --text-secondary: #6b7280; --accent: #10b981; --border: #e5e7eb; --font-family: 'Segoe UI', sans-serif; }
  :root[data-theme="neon"] { --bg-primary: #0f172a; --bg-secondary: #1e293b; --bg-tertiary: #334155; --text-primary: #f8fafc; --text-secondary: #94a3b8; --accent: #38bdf8; --border: #1e293b; --font-family: 'Courier New', monospace; }
  :root[data-theme="vintage"] { --bg-primary: #fffbeb; --bg-secondary: #fef3c7; --bg-tertiary: #fde68a; --text-primary: #78350f; --text-secondary: #92400e; --accent: #d97706; --border: #fcd34d; --font-family: 'Georgia', serif; }
  body, div, input, textarea, video { transition: background-color 0.3s ease, color 0.3s ease; }
`;

let _socket: Socket | null = null;
function getSocket() { if (!_socket) { _socket = io(SOCKET_URL, { transports: ["websocket"], withCredentials: true }); } return _socket; }
const peerConfig = { iceServers: [ { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" } ] };

// --- SOUND HELPER ---
const playSfx = (type: keyof typeof SFX) => {
  try { const audio = new Audio(SFX[type]); audio.volume = 0.4; audio.play().catch(() => {}); } catch (e) {}
};

// --- AUDIO HELPERS ---
let globalAudioContext: AudioContext | null = null;
const getAudioContext = () => { if (!globalAudioContext) { const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext; if (AudioContextClass) globalAudioContext = new AudioContextClass(); } return globalAudioContext; };
const useAudioActivity = (stream: MediaStream | undefined | null) => {
  const [isSpeaking, setIsSpeaking] = useState(false); const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) { setIsSpeaking(false); return; }
    const ctx = getAudioContext(); if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const analyser = ctx.createAnalyser(); analyser.fftSize = 128;
      const source = ctx.createMediaStreamSource(stream); source.connect(analyser);
      const check = () => { const data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(data); let sum = 0; for (let i = 0; i < data.length; i += 2) sum += data[i]; setIsSpeaking(sum / (data.length / 2) > 10); };
      intervalRef.current = setInterval(check, 250); return () => { if (intervalRef.current) clearInterval(intervalRef.current); try { source.disconnect(); analyser.disconnect(); } catch {} };
    } catch (e) { console.error(e); }
  }, [stream]);
  return isSpeaking;
};

// --- USER MEDIA COMPONENT ---
const UserMediaComponent = React.memo(({ stream, isLocal, userId, userAvatar, username, outputDeviceId, isScreenShare }: { stream: MediaStream | null; isLocal: boolean; userId: string; userAvatar?: string; username?: string; outputDeviceId?: string; isScreenShare?: boolean; }) => {
  const videoRef = useRef<HTMLVideoElement>(null); const isSpeaking = useAudioActivity(stream); const [hasVideo, setHasVideo] = useState(false);
  useEffect(() => { if(!stream) { setHasVideo(false); return; } const checkVideo = () => setHasVideo(stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled); checkVideo(); stream.getVideoTracks().forEach(track => { track.onmute = checkVideo; track.onunmute = checkVideo; track.onended = checkVideo; }); const interval = setInterval(checkVideo, 1000); return () => clearInterval(interval); }, [stream]);
  useEffect(() => { if (videoRef.current && stream && videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream; }, [stream]);
  useEffect(() => { if (isLocal || !videoRef.current || !outputDeviceId) return; const anyVideo = videoRef.current as any; if (typeof anyVideo.setSinkId === "function") anyVideo.setSinkId(outputDeviceId).catch(() => {}); }, [outputDeviceId, isLocal]);
  return (
    <div className="flex flex-col items-center justify-center p-2 h-full w-full relative bg-black/20 rounded-xl overflow-hidden border border-white/10">
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${hasVideo ? 'opacity-100' : 'opacity-0'} ${isLocal && !isScreenShare ? 'scale-x-[-1]' : ''}`} />
      {!hasVideo && (<div className="z-10 flex flex-col items-center"><div className={`relative w-24 h-24 rounded-full p-1 transition-all ${isSpeaking ? "bg-green-500 shadow-lg scale-110" : "bg-gray-700"}`}><img src={userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} className="w-full h-full rounded-full object-cover border-2 border-gray-900" alt="avatar"/>{!isLocal && !stream?.getAudioTracks()[0]?.enabled && <div className="absolute bottom-0 right-0 bg-red-500 rounded-full p-1"><MicOff size={12} className="text-white" /></div>}</div></div>)}
      <div className="absolute bottom-2 left-2 z-20 text-white font-bold text-xs bg-black/60 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">{username || "User"} {isLocal && "(You)"}</div>
    </div>
  );
});
UserMediaComponent.displayName = "UserMediaComponent";

const GroupPeerWrapper = React.memo(({ peer, peerID, outputDeviceId, allUsers }: { peer: Peer.Instance; peerID: string; outputDeviceId?: string; allUsers: any[]; }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  useEffect(() => { const onStream = (s: MediaStream) => setStream(s); peer.on("stream", onStream); if ((peer as any)._remoteStreams?.length) setStream((peer as any)._remoteStreams[0]); return () => { peer.off("stream", onStream); }; }, [peer]);
  const u = allUsers.find((x: any) => x.socketId === peerID);
  return <UserMediaComponent stream={stream} isLocal={false} userId={peerID} userAvatar={u?.avatar} username={u?.username || "Connecting..."} outputDeviceId={outputDeviceId} isScreenShare={false}/>;
});
GroupPeerWrapper.displayName = "GroupPeerWrapper";

// ============================ APP ============================
export default function EcoTalkApp() {
  const socket = useMemo(() => getSocket(), []);
  const [theme, setTheme] = useState("minimal");
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const currentUserRef = useRef<any>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authInput, setAuthInput] = useState({ username: "", password: "" });
  const [myServers, setMyServers] = useState<any[]>([]);
  const [myFriends, setMyFriends] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [currentServerMembers, setCurrentServerMembers] = useState<any[]>([]);
  const [voiceStates, setVoiceStates] = useState<Record<number, any[]>>({});
  const [activeServerId, setActiveServerId] = useState<number | null>(null);
  const [activeServerData, setActiveServerData] = useState<any>(null);
  const [activeChannel, setActiveChannel] = useState<any>(null);
  const [activeDM, setActiveDM] = useState<any>(null);
  const activeDMRef = useRef<any>(null);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editInputText, setEditInputText] = useState("");
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelType, setChannelType] = useState("text");
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUserName, setInviteUserName] = useState("");
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [editServerName, setEditServerName] = useState("");
  const [editServerDesc, setEditServerDesc] = useState("");
  const [editServerIcon, setEditServerIcon] = useState("");
  const [editingChannel, setEditingChannel] = useState<any>(null);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [editUserName, setEditUserName] = useState("");
  const [editUserAvatar, setEditUserAvatar] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const serverIconInputRef = useRef<HTMLInputElement>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>("");
  const [enableNoiseSuppression, setEnableNoiseSuppression] = useState(true);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const testAudioRef = useRef<HTMLAudioElement>(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<number | null>(null);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ peerID: string; peer: Peer.Instance }[]>([]);
  const peersRef = useRef<{ peerID: string; peer: Peer.Instance }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const lastTypingTime = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatLastSeen = (d: string) => { if (!d) return "Offline"; const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (diff < 1) return "Just now"; if (diff < 60) return `${diff}m ago`; const hours = Math.floor(diff / 60); return hours < 24 ? `${hours}h ago` : new Date(d).toLocaleDateString(); };
  const formatDateHeader = (d: string) => { const date = new Date(d); const now = new Date(); const yesterday = new Date(); yesterday.setDate(now.getDate() - 1); if (date.toDateString() === now.toDateString()) return "Today"; if (date.toDateString() === yesterday.toDateString()) return "Yesterday"; return date.toLocaleDateString(); };

  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { activeDMRef.current = activeDM; }, [activeDM]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('eco_theme', theme); }, [theme]);

  useEffect(() => {
    setMounted(true); const storedToken = localStorage.getItem("eco_token"); if (storedToken) { setToken(storedToken); fetchUserData(storedToken); }
    const savedTheme = localStorage.getItem("eco_theme"); if (savedTheme) setTheme(savedTheme);
    const savedMic = localStorage.getItem("eco_mic_id"); const savedSpeaker = localStorage.getItem("eco_speaker_id"); if (savedMic) setSelectedMicId(savedMic); if (savedSpeaker) setSelectedSpeakerId(savedSpeaker);
    const savedNC = localStorage.getItem("eco_nc"); if (savedNC !== null) setEnableNoiseSuppression(savedNC === "true");
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) { navigator.mediaDevices.enumerateDevices().then((d) => { setAudioInputs(d.filter((x) => x.kind === "audioinput")); setAudioOutputs(d.filter((x) => x.kind === "audiooutput")); }).catch(() => {}); }
    socket.emit("request_voice_states");
    const unlock = () => { try { const ctx = getAudioContext(); if (ctx && ctx.state === "suspended") ctx.resume(); } catch (e) { console.log(e); } document.removeEventListener("click", unlock); };
    document.addEventListener("click", unlock); return () => { document.removeEventListener("click", unlock); };
  }, []);

  useEffect(() => {
    const onReceiveMessage = (msg: any) => {
      setMessages((p) => [...p, msg]);
      if (msg.userId !== currentUserRef.current?.id) playSfx("msg"); // Sound!
      setMyFriends((prev) => {
        const currentUserId = currentUserRef.current?.id;
        let partnerId = msg.userId === currentUserId ? activeDMRef.current?.id : msg.userId;
        let partnerData = msg.userId === currentUserId ? activeDMRef.current : (msg.user || { id: msg.userId, username: msg.author, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.userId}`, status: 'online' });
        if (!partnerId) return prev; const filtered = prev.filter(f => f.id !== partnerId); let friendObj = prev.find(f => f.id === partnerId) || partnerData; if (!friendObj) return prev; return [friendObj, ...filtered];
      });
    };
    const onLoadHistory = (h: any[]) => setMessages(h); const onNewNotif = (n: any) => { setNotifications((p) => [n, ...p]); playSfx("msg"); };
    const onFriendAdded = (f: any) => { setMyFriends((p) => (p.find((x) => x.id === f.id) ? p : [...p, f])); if (tokenRef.current) fetchUserData(tokenRef.current); };
    const onFriendRemoved = (id: number) => { setMyFriends((p) => p.filter((f) => f.id !== id)); setActiveDM((prev: any) => (prev?.id === id ? null : prev)); };
    const onUserStatus = ({ userId, status, lastSeen }: any) => { setMyFriends((p) => p.map((f) => (f.id === userId ? { ...f, status, lastSeen } : f))); setCurrentServerMembers((p) => p.map((m) => (m.id === userId ? { ...m, status, lastSeen } : m))); };
    const onVoiceUpdate = ({ roomId, users }: any) => { setVoiceStates((prev) => { const key = Number(roomId); if (JSON.stringify(prev[key]) === JSON.stringify(users)) return prev; return { ...prev, [key]: users }; }); };
    const onMsgUpdated = (u: any) => setMessages((p) => p.map((m) => (m.id === u.id ? u : m)));
    const onMsgDeleted = (id: number) => setMessages((p) => p.filter((m) => m.id !== id));
    const onTyping = (id: number | null | undefined) => { const me = currentUserRef.current?.id; if (!id || id === me) return; setTypingUsers((p) => Array.from(new Set([...p, id]))); };
    const onStopTyping = (id: number | null | undefined) => { if (!id) return; setTypingUsers((p) => p.filter((x) => x !== id)); };

    socket.on("receive_message", onReceiveMessage); socket.on("load_history", onLoadHistory); socket.on("new_notification", onNewNotif); socket.on("friend_added", onFriendAdded);
    socket.on("friend_removed", onFriendRemoved); socket.on("user_status_changed", onUserStatus); socket.on("voice_room_update", onVoiceUpdate);
    socket.on("message_updated", onMsgUpdated); socket.on("message_deleted", onMsgDeleted); socket.on("user_typing", onTyping); socket.on("user_stop_typing", onStopTyping);
    return () => {
      socket.off("receive_message", onReceiveMessage); socket.off("load_history", onLoadHistory); socket.off("new_notification", onNewNotif); socket.off("friend_added", onFriendAdded);
      socket.off("friend_removed", onFriendRemoved); socket.off("user_status_changed", onUserStatus); socket.off("voice_room_update", onVoiceUpdate);
      socket.off("message_updated", onMsgUpdated); socket.off("message_deleted", onMsgDeleted); socket.off("user_typing", onTyping); socket.off("user_stop_typing", onStopTyping);
    };
  }, [socket]);

  useEffect(() => {
    if (!activeVoiceChannel || !myStream) return;
    peersRef.current = []; setPeers([]);
    const handleAllUsers = (users: string[]) => { const fresh: { peerID: string; peer: Peer.Instance }[] = []; users.forEach((userID: string) => { if (userID === socket.id) return; if (peersRef.current.find((x) => x.peerID === userID)) return; const peer = createPeer(userID, socket.id!, myStream, socket); peersRef.current.push({ peerID: userID, peer }); fresh.push({ peerID: userID, peer }); }); if (fresh.length) setPeers((prev) => [...prev, ...fresh]); };
    const handleUserJoined = (pl: any) => { if (!pl?.callerID || pl.callerID === socket.id || peersRef.current.find((x) => x.peerID === pl.callerID)) return; const peer = addPeer(pl.signal, pl.callerID, myStream, socket); peersRef.current.push({ peerID: pl.callerID, peer }); setPeers((prev) => [...prev, { peerID: pl.callerID, peer }]); playSfx("join"); };
    const handleReturned = (pl: any) => { const item = peersRef.current.find((p) => p.peerID === pl.id); if (item && !item.peer.destroyed) item.peer.signal(pl.signal); };
    const handleLeft = (id: string) => { const p = peersRef.current.find((x) => x.peerID === id); if (p) p.peer.destroy(); setPeers(peersRef.current.filter((x) => x.peerID !== id)); peersRef.current = peersRef.current.filter((x) => x.peerID !== id); playSfx("leave"); };
    socket.on("all_users_in_voice", handleAllUsers); socket.on("user_joined_voice", handleUserJoined); socket.on("receiving_returned_signal", handleReturned); socket.on("user_left_voice", handleLeft);
    const t = setTimeout(() => socket.emit("join_voice_channel", activeVoiceChannel), 100);
    return () => { clearTimeout(t); socket.off("all_users_in_voice", handleAllUsers); socket.off("user_joined_voice", handleUserJoined); socket.off("receiving_returned_signal", handleReturned); socket.off("user_left_voice", handleLeft); peersRef.current.forEach((p) => p.peer.destroy()); peersRef.current = []; setPeers([]); socket.emit("leave_voice_channel"); };
  }, [activeVoiceChannel, myStream, socket]);

  function createPeer(userToSignal: string, callerID: string, stream: MediaStream, s: Socket) { const peer = new Peer({ initiator: true, trickle: false, stream, config: peerConfig }); peer.on("signal", (signal) => { s.emit("sending_signal", { userToSignal, callerID, signal }); }); return peer; }
  function addPeer(incomingSignal: any, callerID: string, stream: MediaStream, s: Socket) { const peer = new Peer({ initiator: false, trickle: false, stream, config: peerConfig }); peer.on("signal", (signal) => { s.emit("returning_signal", { signal, callerID }); }); peer.signal(incomingSignal); return peer; }

  const fetchUserData = async (t: string) => { const res = await fetch(`${SOCKET_URL}/api/me`, { headers: { Authorization: t } }); if (!res.ok) return; const d = await res.json(); setCurrentUser(d); setMyServers(d.servers?.map((s: any) => s.server) || []); setMyFriends(d.friendsList || []); socket.emit("auth_user", d.id); };
  const handleAuth = async () => { const res = await fetch(`${SOCKET_URL}/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authInput), }); const data = await res.json(); if (res.ok) { localStorage.setItem("eco_token", data.token); setToken(data.token); playSfx("join"); window.location.reload(); } else { alert(data.error); } };
  const handleLogout = () => { playSfx("leave"); setTimeout(() => { localStorage.removeItem("eco_token"); window.location.reload(); }, 800); };
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => { setInputText(e.target.value); const me = currentUserRef.current; if (!me) return; const room = activeServerId ? `channel_${activeChannel?.id}` : activeDM ? `dm_${[me.id, activeDM.id].sort().join("_")}` : null; if (!room) return; const now = Date.now(); if (now - lastTypingTime.current > 2000) { socket.emit("typing", { room }); lastTypingTime.current = now; } if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = setTimeout(() => { socket.emit("stop_typing", { room }); }, 3000); };
  const openServerSettings = () => { if (!activeServerData) return; setEditServerName(activeServerData.name || ""); setEditServerDesc(activeServerData.description || ""); setEditServerIcon(activeServerData.icon || ""); setShowServerSettings(true); playSfx("click"); };
  const updateServer = async () => { if (!activeServerId || !token) return; const payload = { name: editServerName, description: editServerDesc, icon: editServerIcon }; const res = await fetch(`${SOCKET_URL}/api/server/${activeServerId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify(payload), }); if (res.ok) { setShowServerSettings(false); setMyServers((prev) => prev.map((s) => (s.id === activeServerId ? { ...s, ...payload } : s))); setActiveServerData((prev: any) => ({ ...prev, ...payload })); } };
  const deleteServer = async () => { if (!activeServerId || !token) return; if (!confirm("Delete?")) return; const res = await fetch(`${SOCKET_URL}/api/server/${activeServerId}`, { method: "DELETE", headers: { Authorization: token }, }); if (res.ok) { setShowServerSettings(false); setActiveServerId(null); fetchUserData(token); } };
  const openChannelSettings = (e: any, channel: any) => { e.stopPropagation(); setEditingChannel(channel); setNewChannelName(channel.name); playSfx("click"); };
  const updateChannel = async () => { if (!editingChannel) return; const res = await fetch(`${SOCKET_URL}/api/channels/${editingChannel.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: token! }, body: JSON.stringify({ name: newChannelName }), }); if (res.ok) { setEditingChannel(null); selectServer(activeServerId!); } };
  const deleteChannel = async () => { if (!editingChannel || !confirm("Delete channel?")) return; const res = await fetch(`${SOCKET_URL}/api/channels/${editingChannel.id}`, { method: "DELETE", headers: { Authorization: token! }, }); if (res.ok) { if (activeChannel?.id === editingChannel.id) setActiveChannel(null); setEditingChannel(null); selectServer(activeServerId!); } };
  const openUserProfile = () => { if (!currentUser) return; setEditUserName(currentUser.username); setEditUserAvatar(currentUser.avatar); navigator.mediaDevices.getUserMedia({ audio: true }).then(() => { navigator.mediaDevices.enumerateDevices().then((d) => { setAudioInputs(d.filter((x) => x.kind === "audioinput")); setAudioOutputs(d.filter((x) => x.kind === "audiooutput")); }); }).catch((e) => console.log("Perms denied")); setShowUserSettings(true); playSfx("click"); };
  const saveAudioSettings = (mic: string, spk: string, nc: boolean) => { setSelectedMicId(mic); setSelectedSpeakerId(spk); setEnableNoiseSuppression(nc); localStorage.setItem("eco_mic_id", mic); localStorage.setItem("eco_speaker_id", spk); localStorage.setItem("eco_nc", String(nc)); playSfx("click"); };
  const toggleMicTest = async () => { if (isTestingMic) { if (testAudioRef.current?.srcObject) { (testAudioRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop()); testAudioRef.current.srcObject = null; } setIsTestingMic(false); return; } try { const constraints = { audio: { deviceId: selectedMicId ? { exact: selectedMicId } : undefined, echoCancellation: true, noiseSuppression: enableNoiseSuppression, autoGainControl: true } }; const stream = await navigator.mediaDevices.getUserMedia(constraints); if (testAudioRef.current) { testAudioRef.current.srcObject = stream; const anyAudio = testAudioRef.current as any; if (selectedSpeakerId && typeof anyAudio.setSinkId === "function") { await anyAudio.setSinkId(selectedSpeakerId); } await testAudioRef.current.play().catch(() => {}); } setIsTestingMic(true); } catch (e) { console.error(e); alert("Mic error"); } };
  const closeSettings = () => { if (isTestingMic) toggleMicTest(); setShowUserSettings(false); playSfx("click"); };
  const updateUserProfile = async () => { const res = await fetch(`${SOCKET_URL}/api/me`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: token! }, body: JSON.stringify({ username: editUserName, avatar: editUserAvatar }), }); if (res.ok) { const updated = await res.json(); setCurrentUser((prev: any) => ({ ...prev, ...updated })); setShowUserSettings(false); alert("Updated!"); } };
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>, isUser: boolean) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onloadend = () => { if (isUser) setEditUserAvatar(reader.result as string); else setEditServerIcon(reader.result as string); }; reader.readAsDataURL(file); };
  const removeFriend = async (friendId: number) => { if (!token) return; if (!confirm("Remove?")) return; const res = await fetch(`${SOCKET_URL}/api/friends/${friendId}`, { method: "DELETE", headers: { Authorization: token }, }); if (res.ok) { setMyFriends((prev) => prev.filter((f) => f.id !== friendId)); if (activeDM?.id === friendId) setActiveDM(null); } };
  const kickMember = async (userId: number) => { if (!activeServerId || !token) return; if (!confirm("Kick?")) return; const res = await fetch(`${SOCKET_URL}/api/server/${activeServerId}/kick/${userId}`, { method: "DELETE", headers: { Authorization: token }, }); if (res.ok) selectServer(activeServerId); };
  const createServer = async () => { if (!newServerName || !token) return; const res = await fetch(`${SOCKET_URL}/api/servers`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ name: newServerName }), }); if (res.ok) { setNewServerName(""); setShowCreateServer(false); fetchUserData(token); } };
  const createChannel = async () => { if (!newChannelName || !activeServerId || !token) return; const res = await fetch(`${SOCKET_URL}/api/channels`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ name: newChannelName, serverId: activeServerId, type: channelType }), }); if (res.ok) { setNewChannelName(""); setShowCreateChannel(false); selectServer(activeServerId); } else { const d = await res.json(); alert(d.error || "Failed"); } };
  const handleNotification = async (id: number, action: "ACCEPT" | "DECLINE") => { if (!token) return; if (action === "ACCEPT") { const notif = notifications.find((n) => n.id === id); if (notif?.type === "FRIEND_REQUEST" && notif.sender) { setMyFriends((prev) => (prev.find((x) => x.id === notif.sender.id) ? prev : [...prev, notif.sender])); } } setNotifications((prev) => prev.filter((n) => n.id !== id)); await fetch(`${SOCKET_URL}/api/notifications/respond`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ notificationId: id, action }), }); if (action === "ACCEPT") fetchUserData(token); playSfx("click"); };
  const addFriend = async () => { if (!token) return; const res = await fetch(`${SOCKET_URL}/api/friends/invite`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ username: friendName }), }); if (res.ok) { setFriendName(""); setShowAddFriend(false); alert("Sent!"); } else alert("Error"); };
  const inviteUser = async () => { if (!token || !activeServerId) return; const res = await fetch(`${SOCKET_URL}/api/servers/invite`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ serverId: activeServerId, username: inviteUserName }), }); if (res.ok) { alert("Sent!"); setInviteUserName(""); setShowInvite(false); } else { const data = await res.json(); alert(data.error); } };
  const selectServer = async (serverId: number) => { if (!token) return; setActiveServerId(serverId); setActiveDM(null); if (activeVoiceChannel) leaveVoiceChannel(); const res = await fetch(`${SOCKET_URL}/api/server/${serverId}`, { headers: { Authorization: token } }); const data = await res.json(); setActiveServerData(data); setCurrentServerMembers(data.members.map((m: any) => m.user)); setMyServers((p) => p.map((s) => (s.id === serverId ? data : s))); if (data.channels.length > 0) selectChannel(data.channels[0]); playSfx("click"); };

  const getMediaConstraints = (video: boolean) => ({ video: video ? { width: 640, height: 480, facingMode: "user" } : false, audio: { deviceId: selectedMicId ? { exact: selectedMicId } : undefined, echoCancellation: true, noiseSuppression: enableNoiseSuppression, autoGainControl: true } });
  const selectChannel = (c: any) => {
    if (activeVoiceChannel === c.id) return; if (activeVoiceChannel && c.type !== "voice") leaveVoiceChannel(); setActiveChannel(c);
    if (c.type === "voice") {
      setActiveVoiceChannel(c.id); playSfx("join");
      navigator.mediaDevices.getUserMedia(getMediaConstraints(false)).then((s) => { setMyStream(s); setIsMuted(false); setIsVideoOn(false); setIsScreenSharing(false); }).catch((e) => { console.error(e); alert("Mic Error"); setActiveVoiceChannel(null); });
    } else { setMessages([]); socket.emit("join_channel", { channelId: c.id }); playSfx("click"); }
  };
  const toggleVideo = async () => { if (!activeVoiceChannel) return; playSfx("click"); if (isVideoOn || isScreenSharing) { const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(false)); if (myStream) myStream.getTracks().forEach(t => t.stop()); setMyStream(stream); setIsVideoOn(false); setIsScreenSharing(false); } else { try { const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(true)); if (myStream) myStream.getTracks().forEach(t => t.stop()); setMyStream(stream); setIsVideoOn(true); setIsScreenSharing(false); } catch (e) { console.error(e); alert("Could not start video"); } } };
  const toggleScreenShare = async () => { if (!activeVoiceChannel) return; playSfx("click"); if (isScreenSharing) { const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(false)); if (myStream) myStream.getTracks().forEach(t => t.stop()); setMyStream(stream); setIsScreenSharing(false); setIsVideoOn(false); } else { try { const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); const micStream = await navigator.mediaDevices.getUserMedia({ audio: getMediaConstraints(false).audio }); const tracks = [ ...screenStream.getVideoTracks(), ...micStream.getAudioTracks() ]; const combinedStream = new MediaStream(tracks); screenStream.getVideoTracks()[0].onended = () => { toggleScreenShare(); }; if (myStream) myStream.getTracks().forEach(t => t.stop()); setMyStream(combinedStream); setIsScreenSharing(true); setIsVideoOn(false); } catch(e) { console.log("Screen share cancelled"); } } };
  const leaveVoiceChannel = () => { if (myStream) myStream.getTracks().forEach((track) => track.stop()); setMyStream(null); setActiveVoiceChannel(null); setIsVideoOn(false); setIsScreenSharing(false); playSfx("leave"); if (activeServerId) { const server = myServers.find((s) => s.id === activeServerId); const firstText = server?.channels?.find((c: any) => c.type === "text"); if (firstText) { setActiveChannel(firstText); setMessages([]); socket.emit("join_channel", { channelId: firstText.id }); } else { setActiveChannel(null); } } else { setActiveChannel(null); } };
  const toggleMute = () => { if (!myStream) return; playSfx("click"); const track = myStream.getAudioTracks()[0]; if (!track) return; track.enabled = !track.enabled; setIsMuted(!track.enabled); };
  const selectDM = (friend: any) => { if (friend.id === currentUser?.id) return; setActiveServerId(null); if (activeVoiceChannel) leaveVoiceChannel(); setActiveDM(friend); setActiveChannel(null); setMessages([]); const me = currentUser; if (!me) return; const ids = [me.id, friend.id].sort(); socket.emit("join_dm", { roomName: `dm_${ids[0]}_${ids[1]}` }); playSfx("click"); };
  const sendMessage = () => { const me = currentUser; if (!me || !inputText) return; socket.emit("send_message", { content: inputText, author: me.username, userId: me.id, channelId: activeServerId ? activeChannel?.id : null, dmRoom: activeDM ? `dm_${[me.id, activeDM.id].sort().join("_")}` : null, }); setInputText(""); const room = activeServerId ? `channel_${activeChannel?.id}` : activeDM ? `dm_${[me.id, activeDM.id].sort().join("_")}` : null; if (room) socket.emit("stop_typing", { room }); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onloadend = () => socket.emit("send_message", { content: null, imageUrl: reader.result, type: "image", author: currentUser.username, userId: currentUser.id, channelId: activeServerId ? activeChannel?.id : null, dmRoom: activeDM ? `dm_${[currentUser.id, activeDM.id].sort().join("_")}` : null, }); reader.readAsDataURL(file); };
  const startEditing = (msg: any) => { setEditingMessageId(msg.id); setEditInputText(msg.content); };
  const submitEdit = async (msgId: number) => { if(!editInputText.trim()) return; await fetch(`${SOCKET_URL}/api/messages/${msgId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': token! }, body: JSON.stringify({ content: editInputText }) }); setEditingMessageId(null); };
  const deleteMessage = async (msgId: number) => { if(!confirm("Delete?")) return; await fetch(`${SOCKET_URL}/api/messages/${msgId}`, { method: 'DELETE', headers: { 'Authorization': token! } }); };
  const toggleReaction = async (msgId: number, emoji: string) => { await fetch(`${SOCKET_URL}/api/messages/${msgId}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token! }, body: JSON.stringify({ emoji }) }); };

  // ===== RENDER =====
  if (!mounted) return <div className="h-screen flex items-center justify-center font-bold text-eco-900">EcoTalk Loading...</div>;
  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 notranslate">
        <style>{THEME_STYLES}</style>
        <div className="bg-white p-8 rounded-xl shadow-xl w-96">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">Login</h1>
          <input className="w-full p-2 border rounded mb-2" placeholder="Username" value={authInput.username} onChange={e=>setAuthInput({...authInput, username:e.target.value})}/><input className="w-full p-2 border rounded mb-4" type="password" placeholder="Password" value={authInput.password} onChange={e=>setAuthInput({...authInput, password:e.target.value})}/><button onClick={handleAuth} className="w-full bg-green-600 text-white p-2 rounded">{authMode==='login'?'Login':'Register'}</button><p className="text-center mt-2 cursor-pointer text-sm" onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>{authMode==='login'?'Need account?':'Have account?'}</p></div>
      </div>
    );
  }

  const activeFriendData = myFriends.find(f => f.id === activeDM?.id);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-[var(--font-family)] notranslate">
      <style>{THEME_STYLES}</style>
      <div className={`flex w-full h-full`}>
        <div className="w-18 bg-gray-900 flex flex-col items-center py-4 space-y-3 z-20 text-white"><div onClick={() => setActiveServerId(null)} className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer ${activeServerId===null ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-green-600'}`}><MessageSquare size={24}/></div><div className="w-8 h-0.5 bg-gray-700 rounded"></div>{myServers.map(s => <div key={s.id} onClick={() => selectServer(s.id)} className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer font-bold overflow-hidden ${activeServerId===s.id ? 'rounded-xl bg-green-500 text-white' : 'bg-gray-700 text-gray-200'}`} title={s.name}>{s.icon && s.icon.startsWith('data:') ? <img src={s.icon} className="w-full h-full object-cover"/> : s.name[0]}</div>)}<div onClick={() => setShowCreateServer(true)} className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-green-400 cursor-pointer"><Plus size={24}/></div></div>
        
        <div className="w-60 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col transition-colors">
          <div className="h-12 border-b border-[var(--border)] flex items-center px-4 font-bold text-[var(--text-primary)] justify-between"><div className="truncate w-32">{activeServerId ? myServers.find(s=>s.id===activeServerId)?.name : 'Direct Messages'}</div><div className="flex gap-2 items-center">{activeServerId && activeServerData?.ownerId === currentUser.id && <Settings size={16} className="cursor-pointer hover:text-[var(--accent)]" onClick={openServerSettings}/>}{!activeServerId && <div className="text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer" onClick={() => setShowAddFriend(true)}><Plus size={18}/></div>}{activeServerId && <UserPlus size={18} className="cursor-pointer hover:text-[var(--accent)]" onClick={() => setShowInvite(true)} />}<div className="relative" onClick={() => setShowNotifPanel(!showNotifPanel)}><Bell size={18} className={`cursor-pointer ${notifications.length > 0 ? 'text-[var(--accent)] animate-pulse' : 'text-[var(--text-secondary)]'}`}/>{notifications.length > 0 && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />}</div></div>{showNotifPanel && <div className="absolute top-12 left-20 w-64 bg-[var(--bg-primary)] border border-[var(--border)] shadow-xl rounded-b-xl z-50 max-h-80 overflow-y-auto text-[var(--text-primary)]"><div className="p-2 text-xs font-bold text-[var(--text-secondary)] border-b">NOTIFICATIONS</div>{notifications.length===0?<div className="p-4 text-center text-sm text-gray-400">No new notifications</div>:notifications.map(n=><div key={n.id} className="p-3 border-b hover:bg-[var(--bg-secondary)] transition-colors"><div className="text-sm mb-2"><span className="font-bold">{n.sender.username}</span> {n.type}</div><div className="flex gap-2"><button onClick={()=>handleNotification(n.id, "ACCEPT")} className="flex-1 bg-green-500 text-white py-1 rounded text-xs font-bold flex items-center justify-center"><Check size={12}/> Accept</button><button onClick={()=>handleNotification(n.id, "DECLINE")} className="flex-1 bg-gray-200 text-gray-600 py-1 rounded text-xs font-bold flex items-center justify-center"><X size={12}/> Decline</button></div></div>)}</div>}</div>
          <div className="flex-1 p-2 overflow-y-auto">{activeServerId ? (<><div className="flex justify-between px-2 mb-2 text-xs font-bold text-[var(--text-secondary)]"><span>TEXT</span><Plus size={14} className="cursor-pointer" onClick={()=>{setChannelType('text'); setShowCreateChannel(true)}}/></div>{myServers.find(s=>s.id===activeServerId)?.channels?.filter((c:any)=>c.type==='text').map((c:any) => <div key={c.id} onClick={()=>selectChannel(c)} className={`flex items-center px-2 py-1 rounded mb-1 cursor-pointer ${activeChannel?.id===c.id ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)]'}`}><Hash size={16} className="mr-1"/> {c.name}</div>)}<div className="flex justify-between px-2 mb-2 mt-4 text-xs font-bold text-[var(--text-secondary)]"><span>VOICE</span><Plus size={14} className="cursor-pointer" onClick={()=>{setChannelType('voice'); setShowCreateChannel(true)}}/></div>{myServers.find(s=>s.id===activeServerId)?.channels?.filter((c:any)=>c.type==='voice').map((c:any) => (<div key={c.id} className="group relative"><div onClick={()=>selectChannel(c)} className={`flex items-center px-2 py-1 rounded mb-1 cursor-pointer justify-between ${activeChannel?.id===c.id ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)]'}`}><div className="flex items-center"><Volume2 size={16} className="mr-1"/> {c.name}</div>{activeServerData?.ownerId === currentUser.id && <Settings size={12} className="opacity-0 group-hover:opacity-100 hover:text-[var(--accent)]" onClick={(e)=>openChannelSettings(e, c)}/>}</div>{voiceStates[c.id]?.map((u: any) => <div key={u.socketId} className="pl-6 flex items-center text-[var(--text-secondary)] text-xs py-1"><img src={u.avatar} className="w-4 h-4 rounded-full mr-2"/>{u.username}</div>)}</div>))}</>) : (myFriends.map(f => <div key={f.id} onClick={()=>selectDM(f)} className={`flex items-center p-2 rounded cursor-pointer ${activeDM?.id===f.id?'bg-[var(--bg-tertiary)]':''}`}><div className="relative w-8 h-8 flex-shrink-0 mr-2"><img src={f.avatar} className="rounded-full w-full h-full object-cover"/><div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${f.status==='online'?'bg-green-500':'bg-gray-400'}`}></div></div><div className="flex-1"><span className="block text-sm font-medium">{f.username}</span></div><Trash2 size={14} className="text-[var(--text-secondary)] hover:text-red-500" onClick={(e) => { e.stopPropagation(); removeFriend(f.id); }} /></div>))}</div>
          <div className="p-2 border-t border-[var(--border)] flex items-center bg-[var(--bg-tertiary)]"><img src={currentUser?.avatar} className="w-8 h-8 rounded-full mr-2"/><div className="font-bold text-sm">{currentUser?.username}</div><Settings size={16} className="ml-auto mr-2 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onClick={openUserProfile}/><LogOut size={16} className="cursor-pointer text-red-500" onClick={handleLogout}/></div>
        </div>

        <div className="flex-1 flex flex-col bg-[var(--bg-primary)] min-w-0 relative transition-colors">
          <div className="h-12 border-b border-[var(--border)] flex items-center justify-between px-4 shadow-sm"><div className="font-bold text-[var(--text-primary)] flex items-center">{activeServerId ? (<>{activeChannel?.type === 'voice' ? <Volume2 className="mr-2"/> : <Hash className="mr-2"/>} {activeChannel?.name}</>) : (<><div className="flex flex-col"><span>{activeDM?.username || 'Select Friend'}</span>{activeDM && (<span className={`text-[10px] font-normal ${activeFriendData?.status==='online'?'text-green-600':'text-gray-400'}`}>{activeFriendData?.status==='online'?'Online':`Last seen: ${formatLastSeen(activeFriendData?.lastSeen)}`}</span>)}</div></>)}</div><div className="flex items-center space-x-4">{activeServerId && <Users className={`cursor-pointer ${showMembersPanel ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} onClick={()=>setShowMembersPanel(!showMembersPanel)}/>}</div></div>
          {activeChannel?.type === 'voice' ? (
             <div className="flex-1 bg-gray-900 p-4 flex flex-col relative"><div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr h-full overflow-y-auto"><UserMediaComponent stream={myStream} isLocal={true} userId="me" username={currentUser?.username} userAvatar={currentUser?.avatar} isScreenShare={isScreenSharing} />{peers.map(p => (<GroupPeerWrapper key={p.peerID} peer={p.peer} peerID={p.peerID} outputDeviceId={selectedSpeakerId} allUsers={voiceStates[activeChannel.id] || []}/>))}</div><div className="h-20 flex justify-center items-center gap-4 mt-4 bg-black/40 rounded-2xl backdrop-blur-md border border-white/10 p-2 max-w-2xl mx-auto"><button onClick={toggleVideo} className={`p-3 rounded-full text-white transition-all hover:scale-105 ${isVideoOn ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600'}`} title="Toggle Camera">{isVideoOn ? <Video /> : <VideoOff />}</button><button onClick={toggleScreenShare} className={`p-3 rounded-full text-white transition-all hover:scale-105 ${isScreenSharing ? 'bg-green-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Share Screen">{isScreenSharing ? <Monitor /> : <MonitorOff />}</button><button onClick={toggleMute} className={`p-3 rounded-full text-white transition-all hover:scale-105 ${isMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Toggle Microphone">{isMuted ? <MicOff/> : <Mic/>}</button><button onClick={leaveVoiceChannel} className="p-3 bg-red-600 rounded-full text-white hover:bg-red-700 hover:scale-105 transition-all" title="Disconnect"><PhoneOff/></button></div></div>
          ) : (
             <><div className="flex-1 overflow-y-auto p-4 space-y-4">{messages.map((m,i) => { const showDate = i===0 || formatDateHeader(messages[i-1].createdAt) !== formatDateHeader(m.createdAt); return ( <div key={m.id} className="group">{showDate && <div className="flex justify-center my-4"><span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-1 rounded-full border border-[var(--border)]">{formatDateHeader(m.createdAt)}</span></div>}<div className="flex items-start hover:bg-[var(--bg-secondary)] p-1 rounded relative"><img src={m.user?.avatar} className="w-10 h-10 rounded-full mr-3 mt-1"/><div className="flex-1 min-w-0"><div className="flex items-baseline"><span className="font-bold text-sm mr-2 text-[var(--text-primary)]">{m.author}</span><span className="text-[10px] text-[var(--text-secondary)]">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>{editingMessageId === m.id ? (<div className="mt-1"><input className="w-full border p-1 rounded text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)]" value={editInputText} onChange={e=>setEditInputText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitEdit(m.id)}/><div className="text-[10px] text-[var(--text-secondary)] mt-1">Esc to cancel • Enter to save</div></div>) : (<div className="text-[var(--text-primary)] text-sm whitespace-pre-wrap">{m.content}</div>)}{m.imageUrl && <img src={m.imageUrl} className="mt-2 rounded-lg max-w-sm"/>}<div className="flex gap-1 mt-1">{m.reactions?.map((r:any) => (<div key={r.id} className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-xs border border-[var(--border)] text-[var(--text-secondary)]" title={r.user.username}>{r.emoji}</div>))}</div></div></div></div>); })}{typingUsers.length > 0 && <div className="text-xs text-[var(--text-secondary)] font-bold px-4 animate-pulse">Someone is typing...</div>}</div><div className="p-4"><div className="border border-[var(--border)] rounded-lg flex items-center p-2 bg-[var(--bg-tertiary)]"><input type="file" ref={fileInputRef} hidden onChange={handleFile}/><Paperclip size={20} className="text-[var(--text-secondary)] cursor-pointer mr-2" onClick={()=>fileInputRef.current?.click()}/><input className="flex-1 outline-none bg-transparent text-[var(--text-primary)]" placeholder="Message..." value={inputText} onChange={handleTyping} onKeyDown={e=>e.key==='Enter'&&sendMessage()}/><Send size={20} className="cursor-pointer text-[var(--text-secondary)]" onClick={sendMessage}/></div></div></>
          )}
        </div>
        {activeServerId && showMembersPanel && (<div className="w-60 bg-[var(--bg-secondary)] border-l border-[var(--border)] p-3 hidden lg:block overflow-y-auto"><h3 className="text-xs font-bold text-[var(--text-secondary)] mb-2">MEMBERS — {currentServerMembers.length}</h3>{currentServerMembers.map(member => (<div key={member.id} className="flex items-center justify-between group p-2 hover:bg-[var(--bg-tertiary)] rounded cursor-pointer" onClick={() => selectDM(member)}><div className="flex items-center gap-2"><div className="relative w-8 h-8 flex-shrink-0"><img src={member.avatar} className="rounded-full w-full h-full object-cover"/><div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${member.status==='online'?'bg-green-500':'bg-gray-400'}`}></div></div><div className="flex flex-col"><span className={`font-medium text-sm leading-tight ${member.id === activeServerData?.ownerId ? 'text-yellow-600' : 'text-[var(--text-primary)]'}`}>{member.username}</span></div></div></div>))}</div>)}
        {showServerSettings && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-xl w-96 shadow-2xl"><div className="flex items-center justify-between mb-4"><h3 className="font-bold text-xl text-gray-900">Server Settings</h3><button className="text-sm text-gray-500" onClick={()=>setShowServerSettings(false)}>Close</button></div><label className="text-xs font-bold text-gray-500">ICON</label><div className="flex items-center gap-4 mb-4"><div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden flex items-center justify-center">{editServerIcon ? <img src={editServerIcon} className="w-full h-full object-cover"/> : <span className="text-2xl font-bold text-gray-400">{editServerName?.[0]}</span>}</div><input type="file" ref={serverIconInputRef} hidden accept="image/*" onChange={(e)=>handleAvatarUpload(e, false)}/><button onClick={()=>serverIconInputRef.current?.click()} className="text-sm text-green-600 hover:underline">Change</button></div><label className="text-xs font-bold text-gray-500">NAME</label><input className="w-full border p-2 rounded mb-4" value={editServerName} onChange={e=>setEditServerName(e.target.value)}/><label className="text-xs font-bold text-gray-500">DESCRIPTION</label><textarea className="w-full border p-2 rounded mb-6 h-20 resize-none" value={editServerDesc} onChange={e=>setEditServerDesc(e.target.value)}/><div className="flex justify-between gap-2"><button onClick={openServerSettings} className="text-sm text-gray-500 hover:underline">Refresh</button><div className="flex gap-2"><button onClick={deleteServer} className="px-4 py-2 text-white bg-red-600 rounded">Delete</button><button onClick={updateServer} className="px-4 py-2 text-white bg-green-600 rounded">Save</button></div></div></div></div>}
        {editingChannel && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-xl w-80 shadow-2xl"><h3 className="font-bold text-xl mb-4 text-gray-900">Edit Channel</h3><input className="w-full border p-2 rounded mb-4" value={newChannelName} onChange={e=>setNewChannelName(e.target.value)}/><div className="flex justify-between"><button onClick={deleteChannel} className="text-red-500 text-sm hover:underline flex items-center"><Trash2 size={14} className="mr-1"/> Delete</button><div className="flex gap-2"><button onClick={()=>setEditingChannel(null)}>Cancel</button><button onClick={updateChannel} className="bg-green-600 text-white px-4 py-2 rounded">Save</button></div></div></div></div>}
        {showUserSettings && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--bg-primary)] p-6 rounded-xl w-96 shadow-2xl overflow-y-auto max-h-[80vh] border border-[var(--border)] text-[var(--text-primary)]">
              <h3 className="font-bold text-xl mb-4">Profile</h3>
              <div className="flex flex-col items-center mb-6"><div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden mb-2 relative group cursor-pointer" onClick={openUserProfile}><img src={currentUser?.avatar} className="w-full h-full object-cover"/></div><input className="text-center font-bold text-lg border-b border-transparent hover:border-gray-300 focus:border-green-500 outline-none bg-transparent" value={editUserName} onChange={e=>setEditUserName(e.target.value)}/></div>
              <div className="mb-6"><h4 className="text-sm font-bold text-[var(--text-secondary)] mb-2 border-b border-[var(--border)] pb-1 flex items-center"><Palette size={14} className="mr-1"/> THEME</h4><div className="flex gap-2 mt-2"><button onClick={() => setTheme('minimal')} className={`flex-1 py-1 text-xs font-bold rounded border ${theme==='minimal'?'bg-gray-200 text-black border-black':'border-gray-300 text-gray-500'}`}>Minimal</button><button onClick={() => setTheme('neon')} className={`flex-1 py-1 text-xs font-bold rounded border ${theme==='neon'?'bg-slate-900 text-cyan-400 border-cyan-400':'border-gray-300 text-gray-500'}`}>Neon</button><button onClick={() => setTheme('vintage')} className={`flex-1 py-1 text-xs font-bold rounded border ${theme==='vintage'?'bg-amber-100 text-amber-900 border-amber-900':'border-gray-300 text-gray-500'}`}>Vintage</button></div></div>
              <div className="mb-6"><h4 className="text-sm font-bold text-[var(--text-secondary)] mb-2 border-b border-[var(--border)] pb-1">AUDIO SETTINGS</h4><label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">MICROPHONE</label><select className="w-full p-2 border rounded mb-3 text-sm bg-[var(--bg-tertiary)]" value={selectedMicId} onChange={(e) => saveAudioSettings(e.target.value, selectedSpeakerId, enableNoiseSuppression)}><option value="">Default</option>{audioInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId}`}</option>)}</select><label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">SPEAKERS</label><select className="w-full p-2 border rounded text-sm bg-[var(--bg-tertiary)] mb-3" value={selectedSpeakerId} onChange={(e) => saveAudioSettings(selectedMicId, e.target.value, enableNoiseSuppression)}><option value="">Default</option>{audioOutputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId}`}</option>)}</select><div className="flex items-center justify-between p-2 border rounded bg-[var(--bg-tertiary)] cursor-pointer" onClick={() => saveAudioSettings(selectedMicId, selectedSpeakerId, !enableNoiseSuppression)}><div className="flex items-center text-sm font-bold">{enableNoiseSuppression && <Zap size={16} className="text-yellow-500 mr-2"/>}{!enableNoiseSuppression && <ZapOff size={16} className="text-gray-400 mr-2"/>} Noise Suppression (AI)</div><div className={`w-8 h-4 rounded-full relative transition-colors ${enableNoiseSuppression ? 'bg-green-500' : 'bg-gray-400'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${enableNoiseSuppression ? 'left-4.5' : 'left-0.5'}`}></div></div></div><div className="mt-4 flex items-center gap-2"><button onClick={toggleMicTest} className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${isTestingMic ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>{isTestingMic ? "Stop Test" : "Check Microphone"}</button><audio ref={testAudioRef} hidden />{isTestingMic && <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>}</div></div>
              <div className="flex justify-end gap-2"><button onClick={closeSettings} className="px-4 py-2 text-[var(--text-secondary)]">Cancel</button><button onClick={updateUserProfile} className="bg-green-600 text-white px-4 py-2 rounded font-bold">Save</button></div>
            </div>
          </div>
        )}
        {showCreateServer && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="bg-white p-6 rounded-xl"><input className="border p-2 w-full mb-4" placeholder="Name" value={newServerName} onChange={e=>setNewServerName(e.target.value)}/><div className="flex justify-end gap-2"><button onClick={()=>setShowCreateServer(false)}>Cancel</button><button onClick={createServer} className="bg-green-600 text-white px-4 py-2 rounded">Create</button></div></div></div>}
        {showCreateChannel && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="bg-white p-6 rounded-xl"><input className="border p-2 w-full mb-4" placeholder="Name" value={newChannelName} onChange={e=>setNewChannelName(e.target.value)}/><div className="flex justify-end gap-2"><button onClick={()=>setShowCreateChannel(false)}>Cancel</button><button onClick={createChannel} className="bg-green-600 text-white px-4 py-2 rounded">Create</button></div></div></div>}
        {showAddFriend && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="bg-white p-6 rounded-xl"><input className="border p-2 w-full mb-4" placeholder="Username" value={friendName} onChange={e=>setFriendName(e.target.value)}/><div className="flex justify-end gap-2"><button onClick={()=>setShowAddFriend(false)}>Cancel</button><button onClick={addFriend} className="bg-green-600 text-white px-4 py-2 rounded">Send</button></div></div></div>}
        {showInvite && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="bg-white p-6 rounded-xl"><input className="border p-2 w-full mb-4" placeholder="Username" value={inviteUserName} onChange={e=>setInviteUserName(e.target.value)}/><div className="flex justify-end gap-2"><button onClick={()=>setShowInvite(false)}>Cancel</button><button onClick={inviteUser} className="bg-green-600 text-white px-4 py-2 rounded">Invite</button></div></div></div>}
      </div>
    </div>
  );
}