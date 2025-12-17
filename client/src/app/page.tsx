"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Hash, Send, Plus, MessageSquare, LogOut, Paperclip, UserPlus, PhoneOff, Bell,
  Check, X, Settings, Trash2, UserMinus, Users, Volume2, Mic, MicOff, Smile, Edit2,
  Palette, Zap, ZapOff, Video, VideoOff, Monitor, MonitorOff, Volume1, VolumeX, Camera,
  Maximize, Minimize, Keyboard, Sliders, Volume, Headphones, HeadphoneOff, WifiOff, 
  UploadCloud, ShoppingBag, Coins, Gift, Package, Star, Sparkles
} from "lucide-react";
import io, { Socket } from "socket.io-client";
import Peer from "simple-peer";

// Полифилл для Simple-Peer в среде Next.js/Browser
if (typeof window !== "undefined") {
  (window as any).global = window;
}

// ===== CONSTANTS =====
const SOCKET_URL = "http://5.129.215.82:3001";

// ===== SHOP SYSTEM =====
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
const RARITY_COLORS: Record<Rarity, string> = {
    common: '#9ca3af',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#eab308'
};

const SHOP_ITEMS = [
  { id: 'col_gold', type: 'color', name: 'Golden Soul', price: 500, rarity: 'legendary', value: '#FFD700' },
  { id: 'col_neon', type: 'color', name: 'Cyber Blue', price: 300, rarity: 'epic', value: '#00FFFF' },
  { id: 'col_rose', type: 'color', name: 'Rose Pink', price: 150, rarity: 'rare', value: '#FF007F' },
  { id: 'col_lime', type: 'color', name: 'Acid Green', price: 150, rarity: 'rare', value: '#39FF14' },
  { id: 'col_red', type: 'color', name: 'Crimson', price: 100, rarity: 'common', value: '#DC143C' },
  { id: 'frm_fire', type: 'frame', name: 'Inferno', price: 1000, rarity: 'legendary', css: { boxShadow: '0 0 15px 4px #FF4500, inset 0 0 10px #FFD700', border: '2px solid #FF4500' } },
  { id: 'frm_ice', type: 'frame', name: 'Frostbite', price: 600, rarity: 'epic', css: { boxShadow: '0 0 15px 4px #00BFFF, inset 0 0 10px #E0FFFF', border: '2px solid #00BFFF' } },
  { id: 'frm_eco', type: 'frame', name: 'Eco Vibe', price: 300, rarity: 'rare', css: { border: '3px solid #32CD32', boxShadow: '0 0 10px #228B22' } },
  { id: 'frm_basic', type: 'frame', name: 'Iron Ring', price: 100, rarity: 'common', css: { border: '3px solid #6b7280' } },
  { id: 'bub_space', type: 'bubble', name: 'Space Void', price: 800, rarity: 'epic', css: { background: 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)', border: '1px solid #6366f1', color: 'white' } },
  { id: 'bub_sunset', type: 'bubble', name: 'Sunset Glow', price: 500, rarity: 'rare', css: { background: 'linear-gradient(to right, #f97316, #db2777)', color: 'white' } },
  { id: 'bub_ghost', type: 'bubble', name: 'Ghost', price: 400, rarity: 'rare', css: { backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)' } },
  { id: 'bub_matrix', type: 'bubble', name: 'Matrix', price: 1000, rarity: 'legendary', css: { backgroundColor: 'black', color: '#00FF00', border: '1px solid #00FF00', fontFamily: 'monospace' } },
];

const THEME_STYLES = `
  :root[data-theme="minimal"] { --bg-primary: #ffffff; --bg-secondary: #f9fafb; --bg-tertiary: #f3f4f6; --text-primary: #111827; --text-secondary: #6b7280; --accent: #10b981; --border: #e5e7eb; --font-family: 'Segoe UI', sans-serif; }
  :root[data-theme="neon"] { --bg-primary: #0f172a; --bg-secondary: #1e293b; --bg-tertiary: #334155; --text-primary: #f8fafc; --text-secondary: #94a3b8; --accent: #38bdf8; --border: #1e293b; --font-family: 'Courier New', monospace; }
  :root[data-theme="vintage"] { --bg-primary: #fffbeb; --bg-secondary: #fef3c7; --bg-tertiary: #fde68a; --text-primary: #78350f; --text-secondary: #92400e; --accent: #d97706; --border: #fcd34d; --font-family: 'Georgia', serif; }
  body { background-color: var(--bg-primary); color: var(--text-primary); transition: all 0.3s ease; }
  @keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }
  .animate-shake { animation: shake 0.5s infinite; }
`;

let _socket: Socket | null = null;
function getSocket() { if (!_socket) { _socket = io(SOCKET_URL, { transports: ["websocket"] }); } return _socket; }
const peerConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// --- AUDIO CONTEXT HELPER ---
let globalAudioContext: AudioContext | null = null;
const getAudioContext = () => { 
  if (!globalAudioContext && typeof window !== "undefined") { 
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) globalAudioContext = new AudioContextClass();
  } 
  return globalAudioContext; 
};

const playSoundEffect = (type: string) => {
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') ctx?.resume();
  const osc = ctx?.createOscillator();
  const gain = ctx?.createGain();
  if (!osc || !gain) return;
  osc.connect(gain); gain.connect(ctx!.destination);
  osc.start(); osc.stop(ctx!.currentTime + 0.1);
};

// === ANALYZER & STREAM HOOKS ===
const useStreamAnalyzer = (stream: MediaStream | null) => {
    const [isTalking, setIsTalking] = useState(false);
    useEffect(() => {
        if (!stream || stream.getAudioTracks().length === 0) { setIsTalking(false); return; }
        const ctx = getAudioContext();
        if (!ctx) return;
        let analyser = ctx.createAnalyser();
        let source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        const interval = setInterval(() => {
            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b) / data.length;
            setIsTalking(avg > 10);
        }, 100);
        return () => { clearInterval(interval); source.disconnect(); };
    }, [stream]);
    return isTalking;
};

const useProcessedStream = (rawStream: MediaStream | null, threshold: number, isMuted: boolean) => {
    const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
    useEffect(() => {
        if (!rawStream) return;
        setProcessedStream(rawStream); // В данном примере возвращаем поток как есть для стабильности
    }, [rawStream]);
    return processedStream;
};

// === COMPONENTS ===
const UserMediaComponent = React.memo(({ stream, isLocal, userId, userAvatar, username, globalDeaf, remoteMuted, miniMode, userCustom }: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useStreamAnalyzer(stream);
  const hasVideo = stream?.getVideoTracks().length > 0;

  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream]);

  const frameStyle = userCustom?.frame ? SHOP_ITEMS.find(i => i.id === userCustom.frame)?.css : {};
  const nameColor = userCustom?.color ? SHOP_ITEMS.find(i => i.id === userCustom.color)?.value : 'white';

  return (
    <div className={`${miniMode ? 'w-32 h-20' : 'w-full h-full'} relative bg-black rounded-xl overflow-hidden flex items-center justify-center border-2 ${isSpeaking ? 'border-green-500' : 'border-transparent'}`}>
      <video ref={videoRef} autoPlay playsInline muted={isLocal || globalDeaf} className="absolute inset-0 w-full h-full object-cover" />
      {!hasVideo && (
        <div className="z-10 relative">
          <div className="w-16 h-16 rounded-full p-1" style={frameStyle}>
            <img src={userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} className="w-full h-full rounded-full object-cover" />
          </div>
          <div className="text-center text-xs mt-2 font-bold" style={{ color: nameColor }}>{username}</div>
        </div>
      )}
      {remoteMuted && <div className="absolute top-2 right-2 bg-red-600 p-1 rounded-full"><MicOff size={12} /></div>}
    </div>
  );
});

const GroupPeerWrapper = ({ peer, peerID, allUsers, globalDeaf, miniMode }: any) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    peer.on("stream", (s: MediaStream) => setStream(s));
  }, [peer]);
  const u = allUsers.find((x: any) => x.socketId === peerID);
  return <UserMediaComponent stream={stream} userId={peerID} userAvatar={u?.avatar} username={u?.username} globalDeaf={globalDeaf} miniMode={miniMode} />;
};

// ============================ MAIN APP ============================
export default function EcoTalkApp() {
  const socket = useMemo(() => getSocket(), []);
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authInput, setAuthInput] = useState({ username: "", password: "" });
  
  // States
  const [myServers, setMyServers] = useState<any[]>([]);
  const [myFriends, setMyFriends] = useState<any[]>([]);
  const [activeServerId, setActiveServerId] = useState<number | null>(null);
  const [activeChannel, setActiveChannel] = useState<any>(null);
  const [activeDM, setActiveDM] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [voiceStates, setVoiceStates] = useState<Record<number, any[]>>({});

  // UI Panels
  const [showShop, setShowShop] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // User Settings Edit
  const [editUserName, setEditUserName] = useState("");
  const [editUserAvatar, setEditUserAvatar] = useState("");
  const [theme, setTheme] = useState("minimal");
  const [voiceThreshold, setVoiceThreshold] = useState(10);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const [muteKey, setMuteKey] = useState<string | null>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState("");

  // Refs
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const testAudioRef = useRef<HTMLAudioElement>(null);
  const [isTestingMic, setIsTestingMic] = useState(false);

  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<any[]>([]);
  const processedStream = useProcessedStream(myStream, voiceThreshold, isMuted);

  useEffect(() => {
    setMounted(true);
    const storedToken = localStorage.getItem("eco_token");
    if (storedToken) {
      setToken(storedToken);
      fetchUserData(storedToken);
    }
  }, []);

  const fetchUserData = async (t: string) => {
    const res = await fetch(`${SOCKET_URL}/api/me`, { headers: { Authorization: t } });
    if (res.ok) {
      const d = await res.json();
      setCurrentUser(d);
      setMyServers(d.servers?.map((s: any) => s.server) || []);
      setMyFriends(d.friendsList || []);
      socket.emit("auth_user", d.id);
    }
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
      window.location.reload();
    } else alert(data.error);
  };

  const openUserProfile = () => {
    if (!currentUser) return;
    setEditUserName(currentUser.username);
    setEditUserAvatar(currentUser.avatar);
    navigator.mediaDevices.enumerateDevices().then(devices => {
        setAudioInputs(devices.filter(d => d.kind === "audioinput"));
    });
    setShowUserSettings(true);
  };

  const closeSettings = () => setShowUserSettings(false);

  const updateUserProfile = async () => {
    const res = await fetch(`${SOCKET_URL}/api/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: token! },
      body: JSON.stringify({ username: editUserName, avatar: editUserAvatar }),
    });
    if (res.ok) {
      setCurrentUser({ ...currentUser, username: editUserName, avatar: editUserAvatar });
      setShowUserSettings(false);
    }
  };

  const toggleMicTest = async () => {
    if (isTestingMic) {
        setIsTestingMic(false);
        return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (testAudioRef.current) testAudioRef.current.srcObject = stream;
    setIsTestingMic(true);
  };

  if (!mounted) return null;

  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-xl w-96">
          <h1 className="text-2xl font-bold mb-4 text-center">EcoTalk</h1>
          <input className="w-full p-2 border rounded mb-2" placeholder="Username" onChange={e => setAuthInput({ ...authInput, username: e.target.value })} />
          <input className="w-full p-2 border rounded mb-4" type="password" placeholder="Password" onChange={e => setAuthInput({ ...authInput, password: e.target.value })} />
          <button onClick={handleAuth} className="w-full bg-green-600 text-white p-2 rounded">{authMode === 'login' ? 'Login' : 'Register'}</button>
          <p className="text-center mt-4 cursor-pointer text-blue-600" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? 'Create an account' : 'Already have an account?'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-all" data-theme={theme}>
      <style>{THEME_STYLES}</style>
      
      {/* SIDEBAR */}
      <div className="w-20 bg-gray-900 flex flex-col items-center py-4 space-y-4">
        <div className="w-12 h-12 bg-gray-700 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-green-600" onClick={() => setActiveServerId(null)}>
          <MessageSquare className="text-white" />
        </div>
        {myServers.map(s => (
          <div key={s.id} className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center cursor-pointer text-white font-bold hover:rounded-2xl transition-all" onClick={() => setActiveServerId(s.id)}>
            {s.name[0]}
          </div>
        ))}
        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center cursor-pointer text-green-500" onClick={() => setShowCreateServer(true)}>
          <Plus />
        </div>
      </div>

      {/* CHANNELS / FRIENDS */}
      <div className="w-64 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col">
        <div className="p-4 font-bold border-b border-[var(--border)] flex justify-between items-center">
            {activeServerId ? "Server" : "Friends"}
            <Bell size={18} className="cursor-pointer" onClick={() => setShowNotifPanel(!showNotifPanel)} />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
            {myFriends.map(f => (
                <div key={f.id} className="p-2 hover:bg-[var(--bg-tertiary)] rounded cursor-pointer flex items-center gap-2" onClick={() => setActiveDM(f)}>
                    <img src={f.avatar} className="w-8 h-8 rounded-full" />
                    <span>{f.username}</span>
                </div>
            ))}
        </div>
        <div className="p-4 bg-[var(--bg-tertiary)] flex items-center justify-between">
            <div className="flex items-center gap-2">
                <img src={currentUser?.avatar} className="w-8 h-8 rounded-full" />
                <span className="text-sm font-bold truncate w-24">{currentUser?.username}</span>
            </div>
            <div className="flex gap-2">
                <Settings size={18} className="cursor-pointer hover:rotate-90 transition-transform" onClick={openUserProfile} />
                <LogOut size={18} className="text-red-500 cursor-pointer" onClick={() => { localStorage.removeItem("eco_token"); window.location.reload(); }} />
            </div>
        </div>
      </div>

      {/* MAIN CHAT */}
      <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
          <div className="h-12 border-b border-[var(--border)] flex items-center px-4 font-bold">
              {activeDM ? `@ ${activeDM.username}` : "Select a conversation"}
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
              {messages.map(m => (
                  <div key={m.id} className="mb-4 flex gap-3">
                      <img src={m.user?.avatar} className="w-10 h-10 rounded-full" />
                      <div>
                          <div className="font-bold text-sm">{m.author}</div>
                          <div className="text-sm bg-[var(--bg-tertiary)] p-2 rounded-lg mt-1">{m.content}</div>
                      </div>
                  </div>
              ))}
          </div>
          <div className="p-4">
              <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-2">
                  <input className="flex-1 bg-transparent outline-none px-2" placeholder="Message..." value={inputText} onChange={e => setInputText(e.target.value)} />
                  <Send className="cursor-pointer" onClick={() => socket.emit("send_message", { content: inputText, userId: currentUser.id })} />
              </div>
          </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО НАСТРОЕК (Исправленный блок) */}
      {showUserSettings && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-primary)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-[var(--border)]">
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings size={20}/> User Settings
              </h2>
              <button onClick={closeSettings} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-full transition-colors">
                <X size={24}/>
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Profile Edit */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-[var(--text-secondary)]">PROFILE</label>
                <div className="flex items-center gap-4">
                  <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                    <img src={editUserAvatar} className="w-20 h-20 rounded-full object-cover border-2 border-green-500" />
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera size={20} className="text-white"/>
                    </div>
                    <input type="file" ref={avatarInputRef} hidden accept="image/*" />
                  </div>
                  <div className="flex-1">
                    <input 
                      type="text" 
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] p-2 rounded-lg outline-none" 
                      value={editUserName} 
                      onChange={(e) => setEditUserName(e.target.value)}
                      placeholder="Username"
                    />
                  </div>
                </div>
              </div>

              {/* Audio Settings */}
              <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                <label className="block text-sm font-bold text-[var(--text-secondary)]">VOICE & AUDIO</label>
                <div className="space-y-2">
                  <span className="text-xs font-medium">Input Device</span>
                  <select className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] p-2 rounded-lg outline-none text-sm">
                    {audioInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
                  </select>
                </div>
                <button onClick={toggleMicTest} className="w-full py-2 rounded-lg font-bold border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-all">
                  {isTestingMic ? "Stop Testing" : "Check Microphone"}
                </button>
                <audio ref={testAudioRef} hidden />
              </div>

              {/* Appearance */}
              <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                <label className="block text-sm font-bold text-[var(--text-secondary)]">APPEARANCE</label>
                <div className="grid grid-cols-3 gap-2">
                  {['minimal', 'neon', 'vintage'].map(t => (
                    <button key={t} onClick={() => setTheme(t)} className={`py-2 rounded-lg text-xs font-bold capitalize border-2 ${theme === t ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-[var(--bg-secondary)]">
              <button onClick={updateUserProfile} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}