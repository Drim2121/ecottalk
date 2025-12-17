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

// ===== CONSTANTS =====
const SOCKET_URL = "http://5.129.215.82:3001";

// ===== SHOP SYSTEM =====
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
const RARITY_COLORS: Record<Rarity, string> = {
    common: '#9ca3af',   // Gray
    rare: '#3b82f6',     // Blue
    epic: '#a855f7',     // Purple
    legendary: '#eab308' // Gold
};

const SHOP_ITEMS = [
  // COLORS
  { id: 'col_gold', type: 'color', name: 'Golden Soul', price: 500, rarity: 'legendary', value: '#FFD700' },
  { id: 'col_neon', type: 'color', name: 'Cyber Blue', price: 300, rarity: 'epic', value: '#00FFFF' },
  { id: 'col_rose', type: 'color', name: 'Rose Pink', price: 150, rarity: 'rare', value: '#FF007F' },
  { id: 'col_lime', type: 'color', name: 'Acid Green', price: 150, rarity: 'rare', value: '#39FF14' },
  { id: 'col_red', type: 'color', name: 'Crimson', price: 100, rarity: 'common', value: '#DC143C' },

  // FRAMES
  { id: 'frm_fire', type: 'frame', name: 'Inferno', price: 1000, rarity: 'legendary', css: { boxShadow: '0 0 15px 4px #FF4500, inset 0 0 10px #FFD700', border: '2px solid #FF4500' } },
  { id: 'frm_ice', type: 'frame', name: 'Frostbite', price: 600, rarity: 'epic', css: { boxShadow: '0 0 15px 4px #00BFFF, inset 0 0 10px #E0FFFF', border: '2px solid #00BFFF' } },
  { id: 'frm_eco', type: 'frame', name: 'Eco Vibe', price: 300, rarity: 'rare', css: { border: '3px solid #32CD32', boxShadow: '0 0 10px #228B22' } },
  { id: 'frm_basic', type: 'frame', name: 'Iron Ring', price: 100, rarity: 'common', css: { border: '3px solid #6b7280' } },

  // BUBBLES (New!)
  { id: 'bub_space', type: 'bubble', name: 'Space Void', price: 800, rarity: 'epic', css: { background: 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)', border: '1px solid #6366f1', color: 'white' } },
  { id: 'bub_sunset', type: 'bubble', name: 'Sunset Glow', price: 500, rarity: 'rare', css: { background: 'linear-gradient(to right, #f97316, #db2777)', color: 'white' } },
  { id: 'bub_ghost', type: 'bubble', name: 'Ghost', price: 400, rarity: 'rare', css: { backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)' } },
  { id: 'bub_matrix', type: 'bubble', name: 'Matrix', price: 1000, rarity: 'legendary', css: { backgroundColor: 'black', color: '#00FF00', border: '1px solid #00FF00', fontFamily: 'monospace' } },
];

// ===== SOUNDS (Base64) =====
const SOUNDS = {
  msg: "data:audio/mpeg;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
  join: "data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
  leave: "data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
  click: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
  cash: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
  rare: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" 
};

// ===== THEMES =====
const THEME_STYLES = `
  :root[data-theme="minimal"] { --bg-primary: #ffffff; --bg-secondary: #f9fafb; --bg-tertiary: #f3f4f6; --text-primary: #111827; --text-secondary: #6b7280; --accent: #10b981; --border: #e5e7eb; --font-family: 'Segoe UI', sans-serif; }
  :root[data-theme="neon"] { --bg-primary: #0f172a; --bg-secondary: #1e293b; --bg-tertiary: #334155; --text-primary: #f8fafc; --text-secondary: #94a3b8; --accent: #38bdf8; --border: #1e293b; --font-family: 'Courier New', monospace; }
  :root[data-theme="vintage"] { --bg-primary: #fffbeb; --bg-secondary: #fef3c7; --bg-tertiary: #fde68a; --text-primary: #78350f; --text-secondary: #92400e; --accent: #d97706; --border: #fcd34d; --font-family: 'Georgia', serif; }
  body, div, input, textarea, video { transition: background-color 0.3s ease, color 0.3s ease; }
  video::-webkit-media-controls { display:none !important; }
  input[type=range] { -webkit-appearance: none; background: transparent; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 14px; width: 14px; border-radius: 50%; background: white; cursor: pointer; margin-top: -5px; box-shadow: 0 0 2px rgba(0,0,0,0.5); }
  input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: rgba(255,255,255,0.3); border-radius: 2px; }
  .shop-grid::-webkit-scrollbar { width: 6px; }
  .shop-grid::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.2); border-radius: 3px; }
  @keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }
  .animate-shake { animation: shake 0.5s; animation-iteration-count: infinite; }
`;

let _socket: Socket | null = null;
function getSocket() { if (!_socket) { _socket = io(SOCKET_URL, { transports: ["websocket"], withCredentials: true }); } return _socket; }
const peerConfig = { iceServers: [ { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" } ] };

// --- AUDIO HELPERS ---
let globalAudioContext: AudioContext | null = null;
const getAudioContext = () => { if (!globalAudioContext) { const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext; if (AudioContextClass) globalAudioContext = new AudioContextClass(); } return globalAudioContext; };

const playSoundEffect = (type: 'msg' | 'join' | 'leave' | 'click' | 'cash' | 'rare') => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  if (type === 'click') {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05);
  } else if (type === 'cash') {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.type = 'triangle';
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } else if (type === 'rare') {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    osc.type = 'square';
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 1);
  } else {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.type = 'sine';
    if (type === 'msg') {
        osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(554, now + 0.1);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.4);
    } else if (type === 'join') {
        osc.frequency.setValueAtTime(300, now); osc.frequency.linearRampToValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.3);
    } else if (type === 'leave') {
        osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(200, now + 0.2);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.3);
    }
    osc.start(now); osc.stop(now + 0.4);
  }
};

// === UNIVERSAL ANALYZER ===
const useStreamAnalyzer = (stream: MediaStream | null) => {
    const [isTalking, setIsTalking] = useState(false);
    useEffect(() => {
        if (!stream || stream.getAudioTracks().length === 0) { setIsTalking(false); return; }
        const ctx = getAudioContext();
        if (!ctx) return;
        let source: MediaStreamAudioSourceNode | null = null;
        let analyser: AnalyserNode | null = null;
        let interval: any = null;
        try {
            if (ctx.state === "suspended") ctx.resume();
            analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            const checkVolume = () => {
                if (!analyser) return;
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
                setIsTalking((sum / data.length) > 10); 
            };
            interval = setInterval(checkVolume, 100);
        } catch (e) {}
        return () => { if (interval) clearInterval(interval); try { source?.disconnect(); analyser?.disconnect(); } catch {} };
    }, [stream]);
    return isTalking;
};

// === PRO VOICE PROCESSING HOOK ===
const useProcessedStream = (rawStream: MediaStream | null, threshold: number, isMuted: boolean) => {
    const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const isMutedRef = useRef(isMuted);
    const thresholdRef = useRef(threshold);

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { thresholdRef.current = threshold; }, [threshold]);

    useEffect(() => {
        if (gainNodeRef.current) {
            const ctx = gainNodeRef.current.context;
            gainNodeRef.current.gain.cancelScheduledValues(ctx.currentTime);
            // Software Mute Logic
            gainNodeRef.current.gain.setValueAtTime(isMuted ? 0 : 1, ctx.currentTime);
        }
    }, [isMuted]);

    useEffect(() => {
        if (!rawStream) return;
        if (rawStream.getVideoTracks().length > 0 || rawStream.getAudioTracks().length === 0) { setProcessedStream(rawStream); return; }

        const ctx = getAudioContext();
        if (!ctx) return;

        const source = ctx.createMediaStreamSource(rawStream);
        const destination = ctx.createMediaStreamDestination();
        const gainNode = ctx.createGain();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;

        source.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(destination);
        
        gainNodeRef.current = gainNode;

        let interval: any;
        const processAudio = () => {
            if (gainNodeRef.current?.gain.value === 0 && isMutedRef.current) return;

            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
            
            if (!isMutedRef.current) {
                if ((sum / data.length) > thresholdRef.current) { 
                    gainNode.gain.setTargetAtTime(1, ctx.currentTime, 0.05); 
                } else { 
                    gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.2); 
                }
            }
        };
        interval = setInterval(processAudio, 50);
        const newTracks = [...destination.stream.getAudioTracks(), ...rawStream.getVideoTracks()];
        setProcessedStream(new MediaStream(newTracks));

        return () => { clearInterval(interval); source.disconnect(); analyser.disconnect(); gainNode.disconnect(); };
    }, [rawStream]);

    return processedStream;
};

// --- COMPONENTS ---
const UserMediaComponent = React.memo(({ stream, isLocal, userId, userAvatar, username, outputDeviceId, isScreenShare, globalDeaf, remoteMuted, miniMode, userCustom }: { stream: MediaStream | null; isLocal: boolean; userId: string; userAvatar?: string; username?: string; outputDeviceId?: string; isScreenShare?: boolean; globalDeaf?: boolean; remoteMuted?: boolean; miniMode?: boolean; userCustom?: any }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSpeaking = useStreamAnalyzer(stream); 
  const [hasVideo, setHasVideo] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);

  // Check for video tracks
  useEffect(() => {
    if(!stream) { setHasVideo(false); return; }
    const checkStatus = () => {
        setHasVideo(stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled);
        const audioTrack = stream.getAudioTracks()[0];
        setIsAudioEnabled(audioTrack ? audioTrack.enabled : false);
    };
    const statusInterval = setInterval(checkStatus, 500);
    checkStatus();
    return () => clearInterval(statusInterval);
  }, [stream]);

  useEffect(() => {
      const handleFsChange = () => { setIsFullscreen(!!document.fullscreenElement); };
      document.addEventListener("fullscreenchange", handleFsChange);
      return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => { if(videoRef.current) videoRef.current.volume = volume; }, [volume]);
  useEffect(() => { if (videoRef.current && stream && videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream; }, [stream]);
  useEffect(() => { if (isLocal || !videoRef.current || !outputDeviceId) return; const anyVideo = videoRef.current as any; if (typeof anyVideo.setSinkId === "function") anyVideo.setSinkId(outputDeviceId).catch(() => {}); }, [outputDeviceId, isLocal]);

  const toggleFullscreen = () => { if (!containerRef.current) return; if (!document.fullscreenElement) { containerRef.current.requestFullscreen().catch(err => console.log(err)); } else { document.exitFullscreen(); } };

  const objectFitClass = (isScreenShare || isFullscreen) ? 'object-contain' : 'object-cover';
  
  // Conditionally render styling for PIP (miniMode)
  const containerClass = miniMode 
    ? 'relative bg-black rounded-lg overflow-hidden border border-white/20 w-full h-full' 
    : (isFullscreen 
        ? 'fixed inset-0 z-50 bg-black rounded-none flex flex-col items-center justify-center' 
        : 'flex flex-col items-center justify-center p-2 h-full w-full relative bg-black/40 rounded-xl overflow-hidden border border-white/10 group transition-all');
  
  const shouldMuteVideoElement = isLocal || (globalDeaf === true);
  const avatarSize = miniMode ? "w-8 h-8" : "w-24 h-24";

  // CUSTOMIZATION LOGIC
  const frameStyle: React.CSSProperties | undefined = userCustom?.frame ? SHOP_ITEMS.find(i => i.id === userCustom.frame)?.css : undefined;
  const nameColor = userCustom?.color ? SHOP_ITEMS.find(i => i.id === userCustom.color)?.value : null;

  const defaultAvatarStyle: React.CSSProperties = {
      boxShadow: isSpeaking && !remoteMuted ? "0 0 15px rgba(34,197,94,0.6)" : "none",
      border: isSpeaking && !remoteMuted ? "2px solid #22c55e" : "2px solid transparent"
  };

  return (
    <div ref={containerRef} className={containerClass}>
      <video ref={videoRef} autoPlay playsInline muted={shouldMuteVideoElement} className={`absolute inset-0 w-full h-full ${objectFitClass} transition-all duration-300 ${hasVideo ? 'opacity-100' : 'opacity-0'} ${isLocal && !isScreenShare ? 'scale-x-[-1]' : ''}`} />
      {!hasVideo && (
        <div className="z-10 flex flex-col items-center">
            {/* AVATAR WITH FRAME */}
            <div 
                className={`relative ${avatarSize} rounded-full p-1 transition-all duration-150 ${isSpeaking && !remoteMuted ? "scale-105" : ""}`}
                style={frameStyle || defaultAvatarStyle}
            >
                <img src={userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} className="w-full h-full rounded-full object-cover border-2 border-gray-900" alt="avatar"/>
            </div>
        </div>
      )}
      
      {hasVideo && isSpeaking && !remoteMuted && (<div className="absolute inset-0 border-4 border-green-500 rounded-xl z-20 pointer-events-none opacity-50"></div>)}
      {remoteMuted && (<div className={`absolute top-2 right-2 bg-red-600 ${miniMode ? 'p-1' : 'p-2'} rounded-full shadow-lg z-20`}><MicOff size={miniMode ? 10 : 16} className="text-white" /></div>)}
      
      {!isLocal && !miniMode && (<div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-3/4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-3 py-1 rounded-full flex items-center gap-2 z-30"><Volume size={14} className="text-gray-300"/><input type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))} className="w-full"/></div>)}
      {!miniMode && <button onClick={toggleFullscreen} className="absolute bottom-10 right-4 p-2 bg-black/50 hover:bg-black/80 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-20">{isFullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}</button>}
      
      {!miniMode && <div className={`absolute bottom-4 left-4 z-20 font-bold text-sm bg-black/60 px-3 py-1 rounded backdrop-blur-sm flex items-center gap-1 ${isFullscreen ? 'scale-125 origin-bottom-left' : ''}`} style={{ color: nameColor || 'white' }}>{username || "Guest"} {isLocal && "(You)"}</div>}
    </div>
  );
});
UserMediaComponent.displayName = "UserMediaComponent";

// === PEER WRAPPER ===
const GroupPeerWrapper = ({ peer, peerID, outputDeviceId, allUsers, globalDeaf, miniMode }: { peer: Peer.Instance; peerID: string; outputDeviceId?: string; allUsers: any[]; globalDeaf: boolean; miniMode?: boolean }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteCustom, setRemoteCustom] = useState<any>(null); 

  useEffect(() => { 
      const onStream = (s: MediaStream) => setStream(s); 
      const onData = (data: any) => {
          try {
              const str = new TextDecoder("utf-8").decode(data);
              const json = JSON.parse(str);
              if (json.type === 'mute-status') setRemoteMuted(json.isMuted);
              if (json.type === 'user-custom') setRemoteCustom(json.custom);
          } catch(e) { console.log("Data channel error", e); }
      };
      peer.on("stream", onStream); 
      peer.on("data", onData);
      if ((peer as any)._remoteStreams?.length) setStream((peer as any)._remoteStreams[0]); 
      return () => { peer.off("stream", onStream); peer.off("data", onData); }; 
  }, [peer]);

  const u = allUsers.find((x: any) => x.socketId === peerID);
  return <UserMediaComponent stream={stream} isLocal={false} userId={peerID} userAvatar={u?.avatar} username={u?.username || "Connecting..."} outputDeviceId={outputDeviceId} isScreenShare={false} globalDeaf={globalDeaf} remoteMuted={remoteMuted} miniMode={miniMode} userCustom={remoteCustom}/>;
};

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
  const [voiceThreshold, setVoiceThreshold] = useState(10); 
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const testAudioRef = useRef<HTMLAudioElement>(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<number | null>(null); 
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<{ peerID: string; peer: Peer.Instance }[]>([]);
  const peersRef = useRef<{ peerID: string; peer: Peer.Instance }[]>([]);
  
  // === MUTE & DEAFEN STATE ===
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const processedStream = useProcessedStream(myStream, voiceThreshold, isMuted);
  const [muteKey, setMuteKey] = useState<string | null>(null);
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const lastTypingTime = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // === DND & CONNECTION & LIGHTBOX & SHOP STATUS ===
  const [isDragging, setIsDragging] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  
  // --- SHOP STATE ---
  const [showShop, setShowShop] = useState(false);
  const [shopTab, setShopTab] = useState<'all' | 'color' | 'frame' | 'bubble' | 'lootbox'>('all');
  const [ecoCoins, setEcoCoins] = useState(0);
  const [myInventory, setMyInventory] = useState<string[]>([]);
  const [myCustomization, setMyCustomization] = useState<{frame?: string, color?: string, bubble?: string}>({});
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  
  // Lootbox
  const [isOpeningBox, setIsOpeningBox] = useState(false);
  const [lootResult, setLootResult] = useState<any>(null);

  useEffect(() => { const savedTheme = localStorage.getItem("eco_theme"); if (savedTheme) { setTheme(savedTheme); document.documentElement.setAttribute('data-theme', savedTheme); } }, []);
  const playSound = (type: 'msg' | 'join' | 'leave' | 'click' | 'cash' | 'rare') => { if (soundEnabled) playSoundEffect(type); };
  const formatLastSeen = (d: string) => { if (!d) return "Offline"; const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (diff < 1) return "Just now"; if (diff < 60) return `${diff}m ago`; const hours = Math.floor(diff / 60); return hours < 24 ? `${hours}h ago` : new Date(d).toLocaleDateString(); };
  const formatDateHeader = (d: string) => { const date = new Date(d); const now = new Date(); const yesterday = new Date(); yesterday.setDate(now.getDate() - 1); if (date.toDateString() === now.toDateString()) return "Today"; if (date.toDateString() === yesterday.toDateString()) return "Yesterday"; return date.toLocaleDateString(); };

  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { activeDMRef.current = activeDM; }, [activeDM]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('eco_theme', theme); }, [theme]);
  
  useEffect(() => {
    if (!token) return;
    const savedCoins = localStorage.getItem('eco_coins');
    const savedInv = localStorage.getItem('eco_inventory');
    const savedCustom = localStorage.getItem('eco_customization');
    const lastLogin = localStorage.getItem('eco_last_login');
    if (savedCoins) setEcoCoins(Number(savedCoins));
    if (savedInv) setMyInventory(JSON.parse(savedInv));
    if (savedCustom) setMyCustomization(JSON.parse(savedCustom));
    const today = new Date().toDateString();
    if (lastLogin !== today) setShowDailyModal(true); else setDailyClaimed(true);
  }, [token]);

  const claimDailyBonus = () => { const newBalance = ecoCoins + 100; setEcoCoins(newBalance); localStorage.setItem('eco_coins', String(newBalance)); localStorage.setItem('eco_last_login', new Date().toDateString()); setDailyClaimed(true); setShowDailyModal(false); playSound('cash'); };
  
  const buyItem = (item: any) => { 
      if (ecoCoins >= item.price) { 
          if (myInventory.includes(item.id)) return; 
          const newBalance = ecoCoins - item.price; 
          const newInv = [...myInventory, item.id]; 
          setEcoCoins(newBalance); 
          setMyInventory(newInv); 
          localStorage.setItem('eco_coins', String(newBalance)); 
          localStorage.setItem('eco_inventory', JSON.stringify(newInv)); 
          playSound('cash'); 
      } else { alert("Not enough EcoCoins!"); } 
  };
  
  const toggleEquip = (item: any) => { 
      const newCustom = { ...myCustomization }; 
      if (item.type === 'frame') newCustom.frame = newCustom.frame === item.id ? undefined : item.id;
      else if (item.type === 'color') newCustom.color = newCustom.color === item.id ? undefined : item.id;
      else if (item.type === 'bubble') newCustom.bubble = newCustom.bubble === item.id ? undefined : item.id;
      setMyCustomization(newCustom); 
      localStorage.setItem('eco_customization', JSON.stringify(newCustom)); 
      playSound('click'); 
      broadcastCustomization(newCustom); 
  };

  const openLootbox = () => {
      if (ecoCoins < 100) return alert("Need 100 Coins!");
      setEcoCoins(prev => {
          const n = prev - 100;
          localStorage.setItem('eco_coins', String(n));
          return n;
      });
      setIsOpeningBox(true);
      playSound('click');
      
      setTimeout(() => {
          const rand = Math.random() * 100;
          let pool: any[] = [];
          if (rand < 50) pool = SHOP_ITEMS.filter(i => i.rarity === 'common');
          else if (rand < 80) pool = SHOP_ITEMS.filter(i => i.rarity === 'rare');
          else if (rand < 95) pool = SHOP_ITEMS.filter(i => i.rarity === 'epic');
          else pool = SHOP_ITEMS.filter(i => i.rarity === 'legendary');

          const item = pool[Math.floor(Math.random() * pool.length)];
          setLootResult(item);
          setIsOpeningBox(false);
          
          if (!myInventory.includes(item.id)) {
              const newInv = [...myInventory, item.id];
              setMyInventory(newInv);
              localStorage.setItem('eco_inventory', JSON.stringify(newInv));
          }
          
          if (item.rarity === 'legendary' || item.rarity === 'epic') playSound('rare');
          else playSound('cash');
      }, 2000);
  };

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => { setIsOffline(false); socket.connect(); };
    window.addEventListener('offline', handleOffline); window.addEventListener('online', handleOnline);
    return () => { window.removeEventListener('offline', handleOffline); window.removeEventListener('online', handleOnline); };
  }, [socket]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && viewingImage) setViewingImage(null); };
    window.addEventListener('keydown', handleEsc); return () => window.removeEventListener('keydown', handleEsc);
  }, [viewingImage]);

  const broadcastCustomization = (custom: any) => {
      const msg = JSON.stringify({ type: 'user-custom', custom });
      peersRef.current.forEach(p => { if (p.peer && !p.peer.destroyed) { try { p.peer.send(msg); } catch(e) {} } });
  }
  const broadcastMuteState = (muted: boolean) => {
      const msg = JSON.stringify({ type: 'mute-status', isMuted: muted });
      peersRef.current.forEach(p => { if (p.peer && !p.peer.destroyed) { try { p.peer.send(msg); } catch(e) {} } });
  };
  useEffect(() => { broadcastMuteState(isMuted); }, [isMuted, peers]);
  useEffect(() => { if (processedStream) { processedStream.getAudioTracks().forEach(track => { track.enabled = !isMuted; }); } }, [isMuted, processedStream]);
  
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            socket.emit("send_message", { 
                content: null, imageUrl: reader.result, type: "image", 
                author: currentUser.username, userId: currentUser.id, 
                channelId: activeServerId ? activeChannel?.id : null, 
                dmRoom: activeDM ? `dm_${[currentUser.id, activeDM.id].sort().join("_")}` : null, userCustom: myCustomization 
            });
        };
        reader.readAsDataURL(file);
    }
  };
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
       const items = e.clipboardData.items;
       for (let i = 0; i < items.length; i++) {
           if (items[i].type.indexOf("image") !== -1) {
               e.preventDefault(); 
               const file = items[i].getAsFile();
               if (file) {
                   const reader = new FileReader();
                   reader.onloadend = () => {
                       socket.emit("send_message", {
                           content: null, imageUrl: reader.result, type: "image",
                           author: currentUser.username, userId: currentUser.id,
                           channelId: activeServerId ? activeChannel?.id : null,
                           dmRoom: activeDM ? `dm_${[currentUser.id, activeDM.id].sort().join("_")}` : null, userCustom: myCustomization
                       });
                   };
                   reader.readAsDataURL(file);
                   return; 
               }
           }
       }
   };
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (isRecordingKey) { e.preventDefault(); setMuteKey(e.code); localStorage.setItem("eco_mute_key", e.code); setIsRecordingKey(false); playSound("click"); } 
          else if (muteKey && e.code === muteKey) { const target = e.target as HTMLElement; if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return; e.preventDefault(); if (activeVoiceChannel && myStream) { toggleMute(); playSound("click"); } }
      };
      window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecordingKey, muteKey, activeVoiceChannel, myStream, isMuted, soundEnabled]); 

  useEffect(() => {
    setMounted(true); const storedToken = localStorage.getItem("eco_token"); if (storedToken) { setToken(storedToken); fetchUserData(storedToken); }
    const savedMic = localStorage.getItem("eco_mic_id"); const savedSpeaker = localStorage.getItem("eco_speaker_id"); if (savedMic) setSelectedMicId(savedMic); if (savedSpeaker) setSelectedSpeakerId(savedSpeaker);
    const savedNC = localStorage.getItem("eco_nc"); if (savedNC !== null) setEnableNoiseSuppression(savedNC === "true");
    const savedSound = localStorage.getItem("eco_sound"); if (savedSound !== null) setSoundEnabled(savedSound === "true");
    const savedKey = localStorage.getItem("eco_mute_key"); if(savedKey) setMuteKey(savedKey);
    const savedThreshold = localStorage.getItem("eco_voice_threshold"); if(savedThreshold) setVoiceThreshold(Number(savedThreshold));
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) { navigator.mediaDevices.enumerateDevices().then((d) => { setAudioInputs(d.filter((x) => x.kind === "audioinput")); setAudioOutputs(d.filter((x) => x.kind === "audiooutput")); }).catch(() => {}); }
    socket.emit("request_voice_states");
    const unlock = () => { try { const ctx = getAudioContext(); if (ctx && ctx.state === "suspended") ctx.resume(); } catch (e) { console.log(e); } document.removeEventListener("click", unlock); };
    document.addEventListener("click", unlock); return () => { document.removeEventListener("click", unlock); };
  }, []);

  useEffect(() => {
    const onReceiveMessage = (msg: any) => {
      setMessages((p) => [...p, msg]); if (msg.userId !== currentUserRef.current?.id) playSound("msg"); 
      setMyFriends((prev) => { const currentUserId = currentUserRef.current?.id; let partnerId = msg.userId === currentUserId ? activeDMRef.current?.id : msg.userId; let partnerData = msg.userId === currentUserId ? activeDMRef.current : (msg.user || { id: msg.userId, username: msg.author, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.userId}`, status: 'online' }); if (!partnerId) return prev; const filtered = prev.filter(f => f.id !== partnerId); let friendObj = prev.find(f => f.id === partnerId) || partnerData; if (!friendObj) return prev; return [friendObj, ...filtered]; });
    };
    const onLoadHistory = (h: any[]) => setMessages(h); const onNewNotif = (n: any) => { setNotifications((p) => [n, ...p]); playSound("msg"); };
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
    return () => { socket.off("receive_message", onReceiveMessage); socket.off("load_history", onLoadHistory); socket.off("new_notification", onNewNotif); socket.off("friend_added", onFriendAdded); socket.off("friend_removed", onFriendRemoved); socket.off("user_status_changed", onUserStatus); socket.off("voice_room_update", onVoiceUpdate); socket.off("message_updated", onMsgUpdated); socket.off("message_deleted", onMsgDeleted); socket.off("user_typing", onTyping); socket.off("user_stop_typing", onStopTyping); };
  }, [socket]);

  useEffect(() => {
    if (!activeVoiceChannel || !myStream || !processedStream) return;
    const streamToSend = processedStream;
    peersRef.current = []; setPeers([]);
    socket.emit("request_voice_states");
    const handleAllUsers = (users: string[]) => { const fresh: { peerID: string; peer: Peer.Instance }[] = []; users.forEach((userID: string) => { if (userID === socket.id) return; if (peersRef.current.find((x) => x.peerID === userID)) return; const peer = createPeer(userID, socket.id!, streamToSend, socket); peersRef.current.push({ peerID: userID, peer }); fresh.push({ peerID: userID, peer }); }); if (fresh.length) setPeers((prev) => [...prev, ...fresh]); };
    const handleUserJoined = (pl: any) => { if (!pl?.callerID || pl.callerID === socket.id || peersRef.current.find((x) => x.peerID === pl.callerID)) return; const peer = addPeer(pl.signal, pl.callerID, streamToSend, socket); peersRef.current.push({ peerID: pl.callerID, peer }); setPeers((prev) => [...prev, { peerID: pl.callerID, peer }]); playSound("join"); }; 
    const handleReturned = (pl: any) => { const item = peersRef.current.find((p) => p.peerID === pl.id); if (item && !item.peer.destroyed) item.peer.signal(pl.signal); };
    const handleLeft = (id: string) => { const p = peersRef.current.find((x) => x.peerID === id); if (p) p.peer.destroy(); setPeers(peersRef.current.filter((x) => x.peerID !== id)); peersRef.current = peersRef.current.filter((x) => x.peerID !== id); playSound("leave"); }; 
    socket.on("all_users_in_voice", handleAllUsers); socket.on("user_joined_voice", handleUserJoined); socket.on("receiving_returned_signal", handleReturned); socket.on("user_left_voice", handleLeft);
    const t = setTimeout(() => socket.emit("join_voice_channel", activeVoiceChannel), 100);
    return () => { clearTimeout(t); socket.off("all_users_in_voice", handleAllUsers); socket.off("user_joined_voice", handleUserJoined); socket.off("receiving_returned_signal", handleReturned); socket.off("user_left_voice", handleLeft); peersRef.current.forEach((p) => p.peer.destroy()); peersRef.current = []; setPeers([]); socket.emit("leave_voice_channel"); };
  }, [activeVoiceChannel, myStream, processedStream, socket]);

  function createPeer(userToSignal: string, callerID: string, stream: MediaStream, s: Socket) { 
      const peer = new Peer({ initiator: true, trickle: false, stream, config: peerConfig }); 
      peer.on("signal", (signal) => { s.emit("sending_signal", { userToSignal, callerID, signal }); }); 
      peer.on("connect", () => { try { peer.send(JSON.stringify({ type: 'mute-status', isMuted: isMuted })); peer.send(JSON.stringify({ type: 'user-custom', custom: myCustomization })); } catch(e){} });
      return peer; 
  }
  function addPeer(incomingSignal: any, callerID: string, stream: MediaStream, s: Socket) { 
      const peer = new Peer({ initiator: false, trickle: false, stream, config: peerConfig }); 
      peer.on("signal", (signal) => { s.emit("returning_signal", { signal, callerID }); }); 
      peer.on("connect", () => { try { peer.send(JSON.stringify({ type: 'mute-status', isMuted: isMuted })); peer.send(JSON.stringify({ type: 'user-custom', custom: myCustomization })); } catch(e){} });
      peer.signal(incomingSignal); 
      return peer; 
  }

  const fetchUserData = async (t: string) => { const res = await fetch(`${SOCKET_URL}/api/me`, { headers: { Authorization: t } }); if (!res.ok) return; const d = await res.json(); setCurrentUser(d); setMyServers(d.servers?.map((s: any) => s.server) || []); setMyFriends(d.friendsList || []); socket.emit("auth_user", d.id); };
  const handleAuth = async () => { const res = await fetch(`${SOCKET_URL}/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authInput), }); const data = await res.json(); if (res.ok) { localStorage.setItem("eco_token", data.token); setToken(data.token); playSound("join"); window.location.reload(); } else { alert(data.error); } };
  const handleLogout = () => { playSound("leave"); setTimeout(() => { localStorage.removeItem("eco_token"); window.location.reload(); }, 800); };
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => { setInputText(e.target.value); const me = currentUserRef.current; if (!me) return; const room = activeServerId ? `channel_${activeChannel?.id}` : activeDM ? `dm_${[me.id, activeDM.id].sort().join("_")}` : null; if (!room) return; const now = Date.now(); if (now - lastTypingTime.current > 2000) { socket.emit("typing", { room }); lastTypingTime.current = now; } if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = setTimeout(() => { socket.emit("stop_typing", { room }); }, 3000); };
  const openServerSettings = () => { if (!activeServerData) return; setEditServerName(activeServerData.name || ""); setEditServerDesc(activeServerData.description || ""); setEditServerIcon(activeServerData.icon || ""); setShowServerSettings(true); playSound("click"); };
  const updateServer = async () => { if (!activeServerId || !token) return; const payload = { name: editServerName, description: editServerDesc, icon: editServerIcon }; const res = await fetch(`${SOCKET_URL}/api/server/${activeServerId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify(payload), }); if (res.ok) { setShowServerSettings(false); setMyServers((prev) => prev.map((s) => (s.id === activeServerId ? { ...s, ...payload } : s))); setActiveServerData((prev: any) => ({ ...prev, ...payload })); } };
  const deleteServer = async () => { if (!activeServerId || !token) return; if (!confirm("Delete?")) return; const res = await fetch(`${SOCKET_URL}/api/server/${activeServerId}`, { method: "DELETE", headers: { Authorization: token }, }); if (res.ok) { setShowServerSettings(false); setActiveServerId(null); fetchUserData(token); } };
  const openChannelSettings = (e: any, channel: any) => { e.stopPropagation(); setEditingChannel(channel); setNewChannelName(channel.name); playSound("click"); };
  const updateChannel = async () => { if (!editingChannel) return; const res = await fetch(`${SOCKET_URL}/api/channels/${editingChannel.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: token! }, body: JSON.stringify({ name: newChannelName }), }); if (res.ok) { setEditingChannel(null); selectServer(activeServerId!); } };
  const deleteChannel = async () => { if (!editingChannel || !confirm("Delete channel?")) return; const res = await fetch(`${SOCKET_URL}/api/channels/${editingChannel.id}`, { method: "DELETE", headers: { Authorization: token! }, }); if (res.ok) { if (activeChannel?.id === editingChannel.id) setActiveChannel(null); setEditingChannel(null); selectServer(activeServerId!); } };
  const openUserProfile = () => { if (!currentUser) return; setEditUserName(currentUser.username); setEditUserAvatar(currentUser.avatar); navigator.mediaDevices.getUserMedia({ audio: true }).then(() => { navigator.mediaDevices.enumerateDevices().then((d) => { setAudioInputs(d.filter((x) => x.kind === "audioinput")); setAudioOutputs(d.filter((x) => x.kind === "audiooutput")); }); }).catch((e) => console.log("Perms denied")); setShowUserSettings(true); playSound("click"); };
  const getMediaConstraints = (video: boolean) => ({ video: video ? { width: 640, height: 480, facingMode: "user" } : false, audio: { deviceId: selectedMicId ? { exact: selectedMicId } : undefined, echoCancellation: true, noiseSuppression: enableNoiseSuppression, autoGainControl: true, googEchoCancellation: true, googAutoGainControl: true, googNoiseSuppression: enableNoiseSuppression, googHighpassFilter: true, googTypingNoiseDetection: true } });
  const saveAudioSettings = (mic: string, spk: string, nc: boolean, sound: boolean, threshold: number) => { setSelectedMicId(mic); setSelectedSpeakerId(spk); setEnableNoiseSuppression(nc); setSoundEnabled(sound); setVoiceThreshold(threshold); localStorage.setItem("eco_mic_id", mic); localStorage.setItem("eco_speaker_id", spk); localStorage.setItem("eco_nc", String(nc)); localStorage.setItem("eco_sound", String(sound)); localStorage.setItem("eco_voice_threshold", String(threshold)); if(sound) playSoundEffect("click"); };
  const toggleMicTest = async () => { if (isTestingMic) { if (testAudioRef.current?.srcObject) { (testAudioRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop()); testAudioRef.current.srcObject = null; } setIsTestingMic(false); return; } try { const constraints = { audio: { deviceId: selectedMicId ? { exact: selectedMicId } : undefined, echoCancellation: true, noiseSuppression: enableNoiseSuppression, autoGainControl: true } }; const stream = await navigator.mediaDevices.getUserMedia(constraints); if (testAudioRef.current) { testAudioRef.current.srcObject = stream; const anyAudio = testAudioRef.current as any; if (selectedSpeakerId && typeof anyAudio.setSinkId === "function") { await anyAudio.setSinkId(selectedSpeakerId); } await testAudioRef.current.play().catch(() => {}); } setIsTestingMic(true); } catch (e) { console.error(e); alert("Mic error"); } };
  const closeSettings = () => { if (isTestingMic) toggleMicTest(); setShowUserSettings(false); playSound("click"); };
  const updateUserProfile = async () => { const res = await fetch(`${SOCKET_URL}/api/me`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: token! }, body: JSON.stringify({ username: editUserName, avatar: editUserAvatar }), }); if (res.ok) { const updated = await res.json(); setCurrentUser((prev: any) => ({ ...prev, ...updated })); setShowUserSettings(false); alert("Updated!"); } };
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>, isUser: boolean) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onloadend = () => { if (isUser) setEditUserAvatar(reader.result as string); else setEditServerIcon(reader.result as string); }; reader.readAsDataURL(file); };
  const removeFriend = async (friendId: number) => { if (!token) return; if (!confirm("Remove?")) return; const res = await fetch(`${SOCKET_URL}/api/friends/${friendId}`, { method: "DELETE", headers: { Authorization: token }, }); if (res.ok) { setMyFriends((prev) => prev.filter((f) => f.id !== friendId)); if (activeDM?.id === friendId) setActiveDM(null); } };
  const kickMember = async (userId: number) => { if (!activeServerId || !token) return; if (!confirm("Kick?")) return; const res = await fetch(`${SOCKET_URL}/api/server/${activeServerId}/kick/${userId}`, { method: "DELETE", headers: { Authorization: token }, }); if (res.ok) selectServer(activeServerId); };
  const createServer = async () => { if (!newServerName || !token) return; const res = await fetch(`${SOCKET_URL}/api/servers`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ name: newServerName }), }); if (res.ok) { setNewServerName(""); setShowCreateServer(false); fetchUserData(token); } };
  const createChannel = async () => { if (!newChannelName || !activeServerId || !token) return; const res = await fetch(`${SOCKET_URL}/api/channels`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ name: newChannelName, serverId: activeServerId, type: channelType }), }); if (res.ok) { setNewChannelName(""); setShowCreateChannel(false); selectServer(activeServerId); } else { const d = await res.json(); alert(d.error || "Failed"); } };
  const handleNotification = async (id: number, action: "ACCEPT" | "DECLINE") => { if (!token) return; if (action === "ACCEPT") { const notif = notifications.find((n) => n.id === id); if (notif?.type === "FRIEND_REQUEST" && notif.sender) { setMyFriends((prev) => (prev.find((x) => x.id === notif.sender.id) ? prev : [...prev, notif.sender])); } } setNotifications((prev) => prev.filter((n) => n.id !== id)); await fetch(`${SOCKET_URL}/api/notifications/respond`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ notificationId: id, action }), }); if (action === "ACCEPT") fetchUserData(token); playSound("click"); };
  const addFriend = async () => { if (!token) return; const res = await fetch(`${SOCKET_URL}/api/friends/invite`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ username: friendName }), }); if (res.ok) { setFriendName(""); setShowAddFriend(false); alert("Sent!"); } else alert("Error"); };
  const inviteUser = async () => { if (!token || !activeServerId) return; const res = await fetch(`${SOCKET_URL}/api/servers/invite`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ serverId: activeServerId, username: inviteUserName }), }); if (res.ok) { alert("Sent!"); setInviteUserName(""); setShowInvite(false); } else { const data = await res.json(); alert(data.error); } };
  const selectServer = async (serverId: number) => { 
      if (!token) return; 
      setActiveServerId(serverId); setActiveDM(null); 
      if (activeVoiceChannel) leaveVoiceChannel(); 
      const res = await fetch(`${SOCKET_URL}/api/server/${serverId}`, { headers: { Authorization: token } }); 
      const data = await res.json(); 
      setActiveServerData(data); 
      setCurrentServerMembers(data.members.map((m: any) => m.user)); 
      setMyServers((p) => p.map((s) => (s.id === serverId ? data : s))); 
      
      const firstText = data.channels.find((c: any) => c.type === 'text');
      if (firstText) selectChannel(firstText);
      else if (data.channels.length > 0) selectChannel(data.channels[0]);
      
      playSound("click"); 
  };

  const selectChannel = (c: any) => {
    if (activeVoiceChannel === c.id) { setActiveChannel(c); return; }
    if (c.type === 'voice') {
        if (activeVoiceChannel && activeVoiceChannel !== c.id) leaveVoiceChannel();
        setActiveChannel(c); setActiveVoiceChannel(c.id); playSound("join");
        navigator.mediaDevices.getUserMedia(getMediaConstraints(false)).then((s) => { setMyStream(s); setIsMuted(false); setIsDeafened(false); setIsVideoOn(false); setIsScreenSharing(false); }).catch((e) => { console.error(e); alert("Mic Error"); setActiveVoiceChannel(null); });
    } else {
        setActiveChannel(c); setMessages([]); socket.emit("join_channel", { channelId: c.id }); playSound("click"); 
    }
  };

  const toggleVideo = async () => { if (!activeVoiceChannel) return; playSound("click"); if (isVideoOn || isScreenSharing) { const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(false)); if (myStream) myStream.getTracks().forEach(t => t.stop()); setMyStream(stream); setIsVideoOn(false); setIsScreenSharing(false); } else { try { const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(true)); if (myStream) myStream.getTracks().forEach(t => t.stop()); setMyStream(stream); setIsVideoOn(true); setIsScreenSharing(false); } catch (e) { console.error(e); alert("Could not start video"); } } };
  
  const toggleScreenShare = async () => { 
      if (!activeVoiceChannel) return; playSound("click"); 
      if (isScreenSharing) { 
          const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(false)); if (myStream) myStream.getTracks().forEach(t => t.stop()); setMyStream(stream); setIsScreenSharing(false); setIsVideoOn(false); 
      } else { 
          try { 
              const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); 
              const micStream = await navigator.mediaDevices.getUserMedia({ audio: getMediaConstraints(false).audio }); 
              const ctx = getAudioContext();
              if(ctx && micStream.getAudioTracks().length > 0 && screenStream.getAudioTracks().length > 0) {
                  const micSource = ctx.createMediaStreamSource(micStream); const screenSource = ctx.createMediaStreamSource(screenStream); const dest = ctx.createMediaStreamDestination();
                  micSource.connect(dest); screenSource.connect(dest);
                  const mixedTrack = dest.stream.getAudioTracks()[0];
                  const combinedStream = new MediaStream([screenStream.getVideoTracks()[0], mixedTrack]);
                  screenStream.getVideoTracks()[0].onended = () => { toggleScreenShare(); };
                  if (myStream) myStream.getTracks().forEach(t => t.stop()); setMyStream(combinedStream); setIsScreenSharing(true); setIsVideoOn(false);
              } else {
                  const tracks = [ ...screenStream.getVideoTracks(), ...micStream.getAudioTracks() ]; 
                  const combinedStream = new MediaStream(tracks);
                  screenStream.getVideoTracks()[0].onended = () => { toggleScreenShare(); };
                  if (myStream) myStream.getTracks().forEach(t => t.stop()); setMyStream(combinedStream); setIsScreenSharing(true); setIsVideoOn(false);
              }
          } catch(e) { console.log("Screen share cancelled", e); } 
      } 
  };
  const leaveVoiceChannel = () => { if (myStream) myStream.getTracks().forEach((track) => track.stop()); setMyStream(null); setActiveVoiceChannel(null); setIsVideoOn(false); setIsScreenSharing(false); setIsDeafened(false); setIsMuted(false); playSound("leave"); if (activeChannel?.id === activeVoiceChannel) { const server = myServers.find((s) => s.id === activeServerId); const firstText = server?.channels?.find((c: any) => c.type === "text"); if (firstText) selectChannel(firstText); } };
  
  const toggleMute = () => { 
      if (!myStream) return; 
      playSound("click"); 
      const newState = !isMuted;
      setIsMuted(newState);
      if (!newState && isDeafened) setIsDeafened(false);
  };

  const toggleDeafen = () => {
      if (!myStream) return;
      playSound("click");
      const newState = !isDeafened;
      setIsDeafened(newState);
      if (newState) setIsMuted(true);
  };

  const selectDM = (friend: any) => { if (friend.id === currentUser?.id) return; setActiveServerId(null); if (activeVoiceChannel) leaveVoiceChannel(); setActiveDM(friend); setActiveChannel(null); setMessages([]); const me = currentUser; if (!me) return; const ids = [me.id, friend.id].sort(); socket.emit("join_dm", { roomName: `dm_${ids[0]}_${ids[1]}` }); playSound("click"); };
  const sendMessage = () => { const me = currentUser; if (!me || !inputText) return; socket.emit("send_message", { content: inputText, author: me.username, userId: me.id, channelId: activeServerId ? activeChannel?.id : null, dmRoom: activeDM ? `dm_${[me.id, activeDM.id].sort().join("_")}` : null, userCustom: myCustomization }); setInputText(""); const room = activeServerId ? `channel_${activeChannel?.id}` : activeDM ? `dm_${[me.id, activeDM.id].sort().join("_")}` : null; if (room) socket.emit("stop_typing", { room }); };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onloadend = () => socket.emit("send_message", { content: null, imageUrl: reader.result, type: "image", author: currentUser.username, userId: currentUser.id, channelId: activeServerId ? activeChannel?.id : null, dmRoom: activeDM ? `dm_${[currentUser.id, activeDM.id].sort().join("_")}` : null, userCustom: myCustomization }); reader.readAsDataURL(file); };
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
  const isVoiceActiveView = activeChannel?.type === 'voice';

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-[var(--font-family)] notranslate">
      <style>{THEME_STYLES}</style>
      
      {/* CONNECTION ALERT */}
      {isOffline && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs font-bold text-center py-1 z-[100] animate-pulse">
            <WifiOff size={12} className="inline mr-1"/> Reconnecting...
        </div>
      )}

      <div className={`flex w-full h-full`}>
        {/* SIDEBAR */}
        <div className="w-18 bg-gray-900 flex flex-col items-center py-4 space-y-3 z-20 text-white"><div onClick={() => setActiveServerId(null)} className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer ${activeServerId===null ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-200 hover:bg-green-600'}`}><MessageSquare size={24}/></div><div className="w-8 h-0.5 bg-gray-700 rounded"></div>{myServers.map(s => <div key={s.id} onClick={() => selectServer(s.id)} className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer font-bold overflow-hidden ${activeServerId===s.id ? 'rounded-xl bg-green-500 text-white' : 'bg-gray-700 text-gray-200'}`} title={s.name}>{s.icon && s.icon.startsWith('data:') ? <img src={s.icon} className="w-full h-full object-cover"/> : s.name[0]}</div>)}<div onClick={() => setShowCreateServer(true)} className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-green-400 cursor-pointer"><Plus size={24}/></div><div onClick={() => setShowShop(true)} className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-yellow-400 cursor-pointer hover:bg-yellow-600/20"><ShoppingBag size={24}/></div></div>
        
        {/* CHANNEL LIST */}
        <div className="w-60 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col transition-colors relative">
          <div className="h-12 border-b border-[var(--border)] flex items-center px-4 font-bold text-[var(--text-primary)] justify-between"><div className="truncate w-32">{activeServerId ? myServers.find(s=>s.id===activeServerId)?.name : 'Direct Messages'}</div><div className="flex gap-2 items-center">{activeServerId && activeServerData?.ownerId === currentUser.id && <Settings size={16} className="cursor-pointer hover:text-[var(--accent)]" onClick={openServerSettings}/>}{!activeServerId && <div className="text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer" onClick={() => setShowAddFriend(true)}><Plus size={18}/></div>}{activeServerId && <UserPlus size={18} className="cursor-pointer hover:text-[var(--accent)]" onClick={() => setShowInvite(true)} />}<div className="relative" onClick={() => setShowNotifPanel(!showNotifPanel)}><Bell size={18} className={`cursor-pointer ${notifications.length > 0 ? 'text-[var(--accent)] animate-pulse' : 'text-[var(--text-secondary)]'}`}/>{notifications.length > 0 && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />}</div></div>{showNotifPanel && <div className="absolute top-12 left-20 w-64 bg-[var(--bg-primary)] border border-[var(--border)] shadow-xl rounded-b-xl z-50 max-h-80 overflow-y-auto text-[var(--text-primary)]"><div className="p-2 text-xs font-bold text-[var(--text-secondary)] border-b">NOTIFICATIONS</div>{notifications.length===0?<div className="p-4 text-center text-sm text-gray-400">No new notifications</div>:notifications.map(n=><div key={n.id} className="p-3 border-b hover:bg-[var(--bg-secondary)] transition-colors"><div className="text-sm mb-2"><span className="font-bold">{n.sender.username}</span> {n.type}</div><div className="flex gap-2"><button onClick={()=>handleNotification(n.id, "ACCEPT")} className="flex-1 bg-green-500 text-white py-1 rounded text-xs font-bold flex items-center justify-center"><Check size={12}/> Accept</button><button onClick={()=>handleNotification(n.id, "DECLINE")} className="flex-1 bg-gray-200 text-gray-600 py-1 rounded text-xs font-bold flex items-center justify-center"><X size={12}/> Decline</button></div></div>)}</div>}</div>
          <div className="flex-1 p-2 overflow-y-auto pb-16">
            {activeServerId ? (
              <>
                <div className="flex justify-between px-2 mb-2 text-xs font-bold text-[var(--text-secondary)]"><span>TEXT</span><Plus size={14} className="cursor-pointer" onClick={()=>{setChannelType('text'); setShowCreateChannel(true)}}/></div>
                {myServers.find(s=>s.id===activeServerId)?.channels?.filter((c:any)=>c.type==='text').map((c:any) => (
                    <div key={c.id} onClick={()=>selectChannel(c)} className={`group flex items-center justify-between px-2 py-1 rounded mb-1 cursor-pointer ${activeChannel?.id===c.id ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold' : 'text-[var(--text-secondary)]'}`}>
                        <div className="flex items-center"><Hash size={16} className="mr-1"/> {c.name}</div>
                        {activeServerData?.ownerId === currentUser.id && <Settings size={12} className="opacity-0 group-hover:opacity-100 hover:text-[var(--accent)]" onClick={(e)=>openChannelSettings(e, c)}/>}
                    </div>
                ))}
                <div className="flex justify-between px-2 mb-2 mt-4 text-xs font-bold text-[var(--text-secondary)]"><span>VOICE</span><Plus size={14} className="cursor-pointer" onClick={()=>{setChannelType('voice'); setShowCreateChannel(true)}}/></div>
                {myServers.find(s=>s.id===activeServerId)?.channels?.filter((c:any)=>c.type==='voice').map((c:any) => (
                   <div key={c.id} className="group relative">
                      <div onClick={()=>selectChannel(c)} className={`flex items-center px-2 py-1 rounded mb-1 cursor-pointer justify-between ${activeChannel?.id===c.id ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold' : (activeVoiceChannel === c.id ? 'text-green-600 font-bold' : 'text-[var(--text-secondary)]')}`}>
                          <div className="flex items-center"><Volume2 size={16} className="mr-1"/> {c.name}</div>
                          {activeServerData?.ownerId === currentUser.id && <Settings size={12} className="opacity-0 group-hover:opacity-100 hover:text-[var(--accent)]" onClick={(e)=>openChannelSettings(e, c)}/>}
                      </div>
                      {voiceStates[Number(c.id)]?.map((u: any) => <div key={u.socketId} className="pl-6 flex items-center text-[var(--text-secondary)] text-xs py-1"><img src={u.avatar} className="w-4 h-4 rounded-full mr-2"/>{u.username}</div>)}
                   </div>
                ))}
              </>
            ) : (
               myFriends.map(f => <div key={f.id} onClick={()=>selectDM(f)} className={`flex items-center p-2 rounded cursor-pointer ${activeDM?.id===f.id?'bg-[var(--bg-tertiary)]':''}`}><div className="relative w-8 h-8 flex-shrink-0 mr-2"><img src={f.avatar} className="rounded-full w-full h-full object-cover"/><div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${f.status==='online'?'bg-green-500':'bg-gray-400'}`}></div></div><div className="flex-1"><span className="block text-sm font-medium">{f.username}</span></div><Trash2 size={14} className="text-[var(--text-secondary)] hover:text-red-500" onClick={(e) => { e.stopPropagation(); removeFriend(f.id); }} /></div>)
            )}
          </div>
          
          {/* VOICE CONTROLS */}
          {activeVoiceChannel && (
              <div className="absolute bottom-12 left-0 right-0 bg-green-900/90 text-white p-2 border-t border-green-700 flex items-center justify-between z-20">
                  <div className="flex flex-col text-xs px-2 truncate">
                      <span className="font-bold text-green-100">Voice Connected</span>
                      <span className="text-green-300 truncate">/ {myServers.find(s=>s.id===activeServerId)?.channels.find((c:any)=>c.id===activeVoiceChannel)?.name}</span>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={toggleMute} className={`p-1.5 rounded-full transition-colors ${isMuted ? 'bg-red-500 text-white' : 'hover:bg-white/10 text-gray-200'}`} title="Mute Mic">
                          {isMuted ? <MicOff size={18}/> : <Mic size={18}/>}
                      </button>
                      <button onClick={toggleDeafen} className={`p-1.5 rounded-full transition-colors ${isDeafened ? 'bg-red-500 text-white' : 'hover:bg-white/10 text-gray-200'}`} title="Deafen (Mute Sound)">
                          {isDeafened ? <HeadphoneOff size={18}/> : <Headphones size={18}/>}
                      </button>
                      <button onClick={leaveVoiceChannel} className="p-1.5 rounded-full hover:bg-white/10 text-gray-200" title="Disconnect">
                          <PhoneOff size={18}/>
                      </button>
                  </div>
              </div>
          )}

          <div className="p-2 border-t border-[var(--border)] flex items-center bg-[var(--bg-tertiary)]"><img src={currentUser?.avatar} className="w-8 h-8 rounded-full mr-2"/><div className="font-bold text-sm">{currentUser?.username}</div><Settings size={16} className="ml-auto mr-2 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]" onClick={openUserProfile}/><LogOut size={16} className="cursor-pointer text-red-500" onClick={handleLogout}/></div>
        </div>

        {/* MAIN AREA */}
        <div className="flex-1 flex flex-col bg-[var(--bg-primary)] min-w-0 relative transition-colors">
          <div className="h-12 border-b border-[var(--border)] flex items-center justify-between px-4 shadow-sm"><div className="font-bold text-[var(--text-primary)] flex items-center">{activeServerId ? (<>{activeChannel?.type === 'voice' ? <Volume2 className="mr-2"/> : <Hash className="mr-2"/>} {activeChannel?.name}</>) : (<><div className="flex flex-col"><span>{activeDM?.username || 'Select Friend'}</span>{activeDM && (<span className={`text-[10px] font-normal ${activeFriendData?.status==='online'?'text-green-600':'text-gray-400'}`}>{activeFriendData?.status==='online'?'Online':`Last seen: ${formatLastSeen(activeFriendData?.lastSeen)}`}</span>)}</div></>)}</div><div className="flex items-center space-x-4">{activeServerId && <Users className={`cursor-pointer ${showMembersPanel ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} onClick={()=>setShowMembersPanel(!showMembersPanel)}/>}</div></div>
          
          {/* VOICE VIEW */}
          {isVoiceActiveView ? (
             <div className="flex-1 bg-gray-900 p-4 flex flex-col relative"><div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr h-full overflow-y-auto"><UserMediaComponent stream={isMuted ? null : processedStream} isLocal={true} userId="me" userAvatar={currentUser?.avatar} username={currentUser?.username} isScreenShare={isScreenSharing} userCustom={myCustomization} />{peers.map(p => (<GroupPeerWrapper key={p.peerID} peer={p.peer} peerID={p.peerID} outputDeviceId={selectedSpeakerId} allUsers={voiceStates[activeChannel.id] || []} globalDeaf={isDeafened}/>))}</div><div className="h-20 flex justify-center items-center gap-4 mt-4 bg-black/40 rounded-2xl backdrop-blur-md border border-white/10 p-2 max-w-2xl mx-auto"><button onClick={toggleVideo} className={`p-3 rounded-full text-white transition-all hover:scale-105 ${isVideoOn ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600'}`} title="Toggle Camera">{isVideoOn ? <Video /> : <VideoOff />}</button><button onClick={toggleScreenShare} className={`p-3 rounded-full text-white transition-all hover:scale-105 ${isScreenSharing ? 'bg-green-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Share Screen">{isScreenSharing ? <Monitor /> : <MonitorOff />}</button><button onClick={toggleMute} className={`p-3 rounded-full text-white transition-all hover:scale-105 ${isMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`} title="Toggle Microphone">{isMuted ? <MicOff/> : <Mic/>}</button><button onClick={leaveVoiceChannel} className="p-3 bg-red-600 rounded-full text-white hover:bg-red-700 hover:scale-105 transition-all" title="Disconnect"><PhoneOff/></button></div></div>
          ) : (
             <>
             {/* TEXT CHAT VIEW */}
             <div className="flex-1 overflow-y-auto p-4 space-y-4" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                {isDragging && <div className="absolute inset-0 bg-blue-500/20 border-4 border-blue-500 border-dashed z-50 flex items-center justify-center text-blue-600 font-bold text-xl pointer-events-none"><UploadCloud size={48} className="mr-2"/> Drop files to upload</div>}
                
                {messages.map((m,i) => { 
                    const showDate = i===0 || formatDateHeader(messages[i-1].createdAt) !== formatDateHeader(m.createdAt);
                    const msgNameColor = m.userCustom?.color ? SHOP_ITEMS.find(it => it.id === m.userCustom.color)?.value : '';
                    const msgFrameStyle = m.userCustom?.frame ? SHOP_ITEMS.find(it => it.id === m.userCustom.frame)?.css : undefined;
                    const msgBubbleStyle = m.userCustom?.bubble ? SHOP_ITEMS.find(it => it.id === m.userCustom.bubble)?.css : undefined;
                    
                    return (
                        <div key={m.id} className="group relative hover:bg-[var(--bg-secondary)] p-2 rounded transition-colors">
                           {showDate && <div className="flex justify-center my-4"><span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-1 rounded-full border border-[var(--border)]">{formatDateHeader(m.createdAt)}</span></div>}
                           <div className="flex items-start relative">
                              <div className="w-10 h-10 flex-shrink-0 mr-3 mt-1 relative rounded-full" style={msgFrameStyle ? { ...msgFrameStyle } : {}}>
                                  <img src={m.user?.avatar} className="w-full h-full rounded-full object-cover"/>
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className="flex items-baseline">
                                    <span className="font-bold text-sm mr-2 text-[var(--text-primary)]" style={{ color: msgNameColor }}>{m.author}</span>
                                    <span className="text-[10px] text-[var(--text-secondary)]">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                 </div>
                                 {editingMessageId === m.id ? (
                                    <div className="mt-1"><input className="w-full border p-1 rounded text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)]" value={editInputText} onChange={e=>setEditInputText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitEdit(m.id)} autoFocus/><div className="text-[10px] text-[var(--text-secondary)] mt-1">Esc to cancel • Enter to save</div></div>
                                 ) : (
                                    <div 
                                        className="text-[var(--text-primary)] text-sm whitespace-pre-wrap p-2 rounded-lg"
                                        style={msgBubbleStyle || {}}
                                    >
                                        {m.content}
                                    </div>
                                 )}
                                 {m.imageUrl && (
                                    <img 
                                      src={m.imageUrl} 
                                      className="mt-2 rounded-lg max-w-sm cursor-zoom-in hover:opacity-90 transition-opacity"
                                      onClick={() => setViewingImage(m.imageUrl)}
                                    />
                                 )}
                                 <div className="flex flex-wrap gap-1 mt-1">{m.reactions?.map((r:any) => (<div key={r.id} className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-[10px] border border-[var(--border)] text-[var(--text-secondary)]" title={r.user.username}>{r.emoji}</div>))}</div>
                              </div>
                           </div>
                           <div className="absolute right-2 top-[-10px] hidden group-hover:flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border)] shadow-sm rounded-md px-1 py-0.5 z-10">
                                <button onClick={() => toggleReaction(m.id, "👍")} className="hover:bg-[var(--bg-tertiary)] p-1 rounded text-xs grayscale hover:grayscale-0 transition-all">👍</button>
                                <button onClick={() => toggleReaction(m.id, "😂")} className="hover:bg-[var(--bg-tertiary)] p-1 rounded text-xs grayscale hover:grayscale-0 transition-all">😂</button>
                                <button onClick={() => toggleReaction(m.id, "❤️")} className="hover:bg-[var(--bg-tertiary)] p-1 rounded text-xs grayscale hover:grayscale-0 transition-all">❤️</button>
                                <button onClick={() => toggleReaction(m.id, "🔥")} className="hover:bg-[var(--bg-tertiary)] p-1 rounded text-xs grayscale hover:grayscale-0 transition-all">🔥</button>
                                {currentUser?.id === m.userId && (
                                    <>
                                        <div className="w-[1px] h-3 bg-gray-300 mx-1"></div>
                                        <button onClick={() => startEditing(m)} className="text-gray-500 hover:text-blue-500 p-1 transition-colors"><Edit2 size={12}/></button>
                                        <button onClick={() => deleteMessage(m.id)} className="text-gray-500 hover:text-red-500 p-1 transition-colors"><Trash2 size={12}/></button>
                                    </>
                                )}
                           </div>
                        </div>
                    );
                })}
                {typingUsers.length > 0 && <div className="text-xs text-[var(--text-secondary)] font-bold px-4 animate-pulse">Someone is typing...</div>}
             </div>
             <div className="p-4"><div className="border border-[var(--border)] rounded-lg flex items-center p-2 bg-[var(--bg-tertiary)]"><input type="file" ref={fileInputRef} hidden onChange={handleFile} /><input type="text" className="flex-1 outline-none bg-transparent text-[var(--text-primary)]" placeholder="Message..." value={inputText} onChange={handleTyping} onKeyDown={e=>e.key==='Enter'&&sendMessage()} onPaste={handlePaste} /><Paperclip size={20} className="text-[var(--text-secondary)] cursor-pointer mr-2" onClick={()=>fileInputRef.current?.click()}/><Send size={20} className="cursor-pointer text-[var(--text-secondary)]" onClick={sendMessage}/></div></div>
             
             {/* PIP (PICTURE IN PICTURE) MODE */}
             {!isVoiceActiveView && activeVoiceChannel && (
                <div className="absolute bottom-20 right-4 w-64 h-40 bg-black rounded-lg shadow-2xl overflow-hidden border-2 border-white/20 z-50 cursor-pointer hover:scale-105 transition-transform" onClick={() => {
                    const c = myServers.find(s=>s.id===activeServerId)?.channels.find((x:any)=>x.id===activeVoiceChannel);
                    if(c) selectChannel(c);
                }}>
                    <div className="grid grid-cols-2 h-full bg-gray-900">
                        <UserMediaComponent stream={isMuted ? null : processedStream} isLocal={true} userId="me" userAvatar={currentUser?.avatar} username={currentUser?.username} isScreenShare={isScreenSharing} miniMode={true} userCustom={myCustomization} />
                        {peers.map(p => (<GroupPeerWrapper key={p.peerID} peer={p.peer} peerID={p.peerID} outputDeviceId={selectedSpeakerId} allUsers={voiceStates[activeVoiceChannel] || []} globalDeaf={isDeafened} miniMode={true}/>))}
                    </div>
                </div>
             )}
             </>
          )}
        </div>
        
        {/* LIGHTBOX OVERLAY */}
        {viewingImage && (
            <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setViewingImage(null)}>
                <button className="absolute top-4 right-4 text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all" onClick={() => setViewingImage(null)}>
                    <X size={32}/>
                </button>
                <img 
                    src={viewingImage} 
                    className="max-w-full max-h-full rounded-md shadow-2xl object-contain cursor-zoom-out"
                    onClick={(e) => e.stopPropagation()} 
                />
            </div>
        )}

        {/* SHOP MODAL */}
        {showShop && (
            <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4">
                <div className="bg-[var(--bg-primary)] w-full max-w-2xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-[var(--border)]">
                    <div className="p-6 border-b border-[var(--border)] bg-gradient-to-r from-yellow-500/10 to-transparent">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center"><ShoppingBag className="mr-2 text-yellow-500"/> Item Shop</h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="bg-yellow-500/20 text-yellow-600 px-4 py-2 rounded-full font-bold flex items-center border border-yellow-500/30">
                                    <Coins size={18} className="mr-2"/> {ecoCoins}
                                </div>
                                <button onClick={() => setShowShop(false)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-full"><X size={24}/></button>
                            </div>
                        </div>
                        
                        {/* SHOP TABS */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {['all', 'color', 'frame', 'bubble', 'lootbox'].map((t) => (
                                <button 
                                    key={t}
                                    onClick={() => setShopTab(t as any)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold capitalize transition-colors ${shopTab === t ? 'bg-yellow-500 text-white' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border)]'}`}
                                >
                                    {t === 'lootbox' ? <span className="flex items-center"><Package size={14} className="mr-1"/> Lootbox</span> : t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 shop-grid bg-[var(--bg-secondary)]">
                        {shopTab === 'lootbox' ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className={`w-40 h-40 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(234,179,8,0.4)] mb-8 transition-all ${isOpeningBox ? 'animate-shake' : 'hover:scale-105 cursor-pointer'}`} onClick={!isOpeningBox ? openLootbox : undefined}>
                                    <Package size={80} className="text-white drop-shadow-lg"/>
                                </div>
                                
                                {isOpeningBox ? (
                                    <div className="text-2xl font-bold animate-pulse text-yellow-500">Opening...</div>
                                ) : (
                                    <>
                                        {lootResult ? (
                                            <div className="mb-4 animate-in zoom-in duration-300">
                                                <div className="text-sm text-gray-500 uppercase tracking-widest font-bold mb-2">You Unlocked</div>
                                                <div className="text-3xl font-bold mb-1" style={{ color: RARITY_COLORS[lootResult.rarity as Rarity] }}>{lootResult.name}</div>
                                                <div className="inline-block px-3 py-1 rounded text-xs font-bold text-white uppercase" style={{ backgroundColor: RARITY_COLORS[lootResult.rarity as Rarity] }}>{lootResult.rarity}</div>
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="text-2xl font-bold mb-2">Mystery Box</h3>
                                                <p className="text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">Contains a random item from Common to Legendary rarity. Try your luck!</p>
                                            </>
                                        )}
                                        
                                        <button 
                                            onClick={openLootbox} 
                                            disabled={ecoCoins < 100}
                                            className={`px-8 py-3 rounded-xl font-bold text-lg flex items-center justify-center mx-auto transition-transform active:scale-95 ${ecoCoins >= 100 ? 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-lg shadow-yellow-500/30' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                                        >
                                            <Coins size={20} className="mr-2"/> 100
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {SHOP_ITEMS.filter(i => shopTab === 'all' || i.type === shopTab).map(item => {
                                    const owned = myInventory.includes(item.id);
                                    const equipped = myCustomization[item.type as keyof typeof myCustomization] === item.id;
                                    const rarityColor = RARITY_COLORS[item.rarity as Rarity];
                                    
                                    return (
                                        <div key={item.id} className={`border-2 rounded-xl p-4 flex flex-col items-center bg-[var(--bg-primary)] hover:scale-[1.02] transition-transform relative overflow-hidden ${equipped ? 'ring-2 ring-green-500 border-green-500' : 'border-[var(--border)]'}`}>
                                            
                                            {/* Rarity Tag */}
                                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase" style={{ backgroundColor: rarityColor }}>
                                                {item.rarity}
                                            </div>

                                            <div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-full mb-3 flex items-center justify-center relative overflow-hidden group">
                                                {item.type === 'color' && <div className="w-full h-full opacity-50" style={{ backgroundColor: item.value }}></div>}
                                                {item.type === 'frame' && <div className="absolute inset-0 rounded-full" style={item.css}></div>}
                                                {item.type === 'bubble' && <div className="w-16 h-8 rounded-lg text-[10px] flex items-center justify-center" style={item.css}>Preview</div>}
                                                {(item.type === 'color' || item.type === 'frame') && <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=shop`} className="w-16 h-16 rounded-full absolute z-10"/>}
                                            </div>
                                            
                                            <div className="font-bold mb-1 text-center leading-tight">{item.name}</div>
                                            
                                            <div className="mt-auto w-full pt-3">
                                                {owned ? (
                                                    <button onClick={() => toggleEquip(item)} className={`w-full py-2 rounded-lg font-bold text-sm transition-colors ${equipped ? 'bg-gray-200 text-gray-600' : 'bg-green-600 text-white'}`}>
                                                        {equipped ? 'Unequip' : 'Equip'}
                                                    </button>
                                                ) : (
                                                    <button onClick={() => buyItem(item)} className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-bold text-sm flex items-center justify-center transition-colors">
                                                        <Coins size={14} className="mr-1"/> {item.price}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* DAILY BONUS MODAL */}
        {showDailyModal && (
            <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl text-center max-w-sm w-full animate-in zoom-in duration-300 relative overflow-hidden">
                    <div className="absolute inset-0 bg-yellow-400/10 z-0"></div>
                    <div className="relative z-10">
                        <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-500 shadow-xl shadow-yellow-500/20">
                            <Gift size={48}/>
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 mb-2">Daily Bonus!</h2>
                        <p className="text-gray-600 mb-8 font-medium">You've earned 100 EcoCoins for logging in today.</p>
                        <button onClick={claimDailyBonus} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl text-xl hover:scale-105 transition-transform shadow-lg shadow-green-600/30">
                            Claim +100 Coins
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}