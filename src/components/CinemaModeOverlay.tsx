import React, { useState, useEffect, useRef } from 'react';
import { VideoState, Spectator, ChatMessage, FloatingReaction, QualityPreset } from '../types/cinema';
import Hls from 'hls.js';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MessageSquare,
  Moon,
  Smartphone,
  RotateCw,
  Tv,
} from 'lucide-react';
import { extractYouTubeId } from '../services/videoPresets';

interface CinemaModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  videoState: VideoState;
  isAdmin: boolean;
  canControl: boolean;
  spectators: Spectator[];
  messages: ChatMessage[];
  floatingReactions: FloatingReaction[];
  onPlay: (time?: number) => void;
  onPause: (time?: number) => void;
  onSeek: (time: number) => void;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onChangeQuality: (preset: QualityPreset) => void;
}

export const CinemaModeOverlay: React.FC<CinemaModeOverlayProps> = ({
  isOpen,
  onClose,
  videoState,
  isAdmin,
  canControl,
  spectators,
  messages,
  floatingReactions,
  onPlay,
  onPause,
  onSeek,
  onSendMessage,
  onSendReaction,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [localTime, setLocalTime] = useState<number>(videoState.currentTime || 0);
  const [duration, setDuration] = useState<number>(videoState.duration || 0);
  const [volume, setVolume] = useState<number>(0.95);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [ambientLight, setAmbientLight] = useState<number>(10);
  const [showHud, setShowHud] = useState<boolean>(true);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [forceRotateLandscape, setForceRotateLandscape] = useState<boolean>(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  const hudTimerRef = useRef<any>(null);
  const currentLoadedUrlRef = useRef<string>('');

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const portrait = window.innerHeight > window.innerWidth;
        setIsPortrait(portrait);
      }
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      }

      if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).lock) {
        (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isOpen]);

  // Load HLS or standard source
  useEffect(() => {
    if (!isOpen || !videoState.url) return;
    const video = videoRef.current;
    if (!video) return;

    if (currentLoadedUrlRef.current === videoState.url) return;
    currentLoadedUrlRef.current = videoState.url;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = videoState.url.includes('.m3u8') || videoState.format === 'hls';

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(videoState.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (videoState.isPlaying) {
          video.play().catch(() => {});
        }
      });
      hlsRef.current = hls;
    } else {
      video.src = videoState.url;
      video.load();
      if (videoState.isPlaying) {
        video.play().catch(() => {});
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, videoState.url, videoState.format, videoState.isPlaying]);

  // Sync play/pause/seek
  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (!video) return;

    const serverNow = Date.now();
    const elapsedSinceUpdate = (serverNow - videoState.updatedAt) / 1000;
    const expectedTime = videoState.isPlaying
      ? videoState.currentTime + (elapsedSinceUpdate > 0 && elapsedSinceUpdate < 60 ? elapsedSinceUpdate : 0)
      : videoState.currentTime;

    const drift = Math.abs(video.currentTime - expectedTime);
    if (drift > 1.5) {
      video.currentTime = Math.max(0, expectedTime);
    }

    if (videoState.isPlaying) {
      if (video.paused) {
        video.play().catch(() => {});
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [isOpen, videoState.isPlaying, videoState.currentTime, videoState.updatedAt]);

  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setLocalTime(video.currentTime);
      if (!duration && video.duration) setDuration(video.duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleTimeUpdate);
    };
  }, [isOpen, duration]);

  const handleMouseMove = () => {
    setShowHud(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      if (videoState.isPlaying && !showChat) {
        setShowHud(false);
      }
    }, 4000);
  };

  const handleTogglePlay = () => {
    if (!canControl) return;
    if (videoState.isPlaying) {
      onPause(videoRef.current ? videoRef.current.currentTime : localTime);
    } else {
      onPlay(videoRef.current ? videoRef.current.currentTime : localTime);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  if (!isOpen) return null;

  const isYouTube = videoState.format === 'youtube' || videoState.url.includes('youtube.com') || videoState.url.includes('youtu.be');
  const youtubeId = isYouTube ? extractYouTubeId(videoState.url) : null;

  const reactionEmojis = ['🍿', '👏', '🔥', '😂', '😱', '❤️', '🍻', '🎬'];

  return (
    <div
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      className={`fixed inset-0 z-[9999] bg-black text-white flex flex-col justify-between overflow-hidden select-none ${
        forceRotateLandscape ? 'origin-center rotate-90 w-[100vh] h-[100vw] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''
      }`}
      style={{
        backgroundColor: `rgba(5, 8, 20, ${1 - ambientLight / 100 * 0.4})`,
      }}
    >
      {/* Blue Ambient Projection Halo */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700 blur-3xl opacity-40 z-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(37, 99, 235, 0.35) 0%, transparent 80%)',
        }}
      />

      {/* Floating spectator reactions */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {floatingReactions.map((rx) => (
          <div
            key={rx.id}
            className="absolute bottom-24 flex flex-col items-center animate-cinema-float"
            style={{ left: `${rx.x}%` }}
          >
            <span className="text-4xl md:text-6xl filter drop-shadow-[0_6px_14px_rgba(0,0,0,0.9)]">
              {rx.emoji}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-950/90 text-cyan-300 border border-cyan-500/40 mt-1">
              {rx.userName}
            </span>
          </div>
        ))}
      </div>

      {/* Mobile Portrait Warning */}
      {isPortrait && !forceRotateLandscape && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-blue-600 to-indigo-600 border border-cyan-400/40 text-white px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce">
          <Smartphone className="w-5 h-5 rotate-90 animate-pulse text-cyan-300" />
          <div className="text-xs">
            <p className="font-bold">Gire o celular para Modo Paisagem!</p>
            <p className="text-[10px] text-cyan-100">Ou force o giro no botão abaixo</p>
          </div>
          <button
            onClick={() => setForceRotateLandscape(true)}
            className="px-2 py-1 bg-white text-blue-800 rounded-lg font-bold text-[10px] uppercase shadow"
          >
            Girar 90°
          </button>
        </div>
      )}

      {/* Top HUD */}
      <div
        className={`relative z-40 p-4 md:p-6 bg-gradient-to-b from-black/95 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 ${
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 font-black text-xs tracking-wider shadow-lg shadow-blue-950 flex items-center gap-1.5 border border-cyan-400/30">
            <Tv className="w-3.5 h-3.5 text-white" />
            <span>MODO CINEMA AZUL 4K</span>
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-black text-white drop-shadow truncate max-w-xs md:max-w-xl">
              {videoState.title}
            </h1>
            <p className="text-[11px] text-cyan-300 font-mono">
              Espectadores: {spectators.length}/5 • Qualidade: {videoState.qualityPreset.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-blue-900/60 backdrop-blur-md">
            <Moon className="w-3.5 h-3.5 text-cyan-300" />
            <span className="text-[10px] font-mono text-slate-300">Luzes:</span>
            <input
              type="range"
              min={0}
              max={100}
              value={ambientLight}
              onChange={(e) => setAmbientLight(parseInt(e.target.value))}
              className="w-16 h-1 accent-cyan-400 cursor-pointer"
              title="Ajuste a iluminação da sala"
            />
            <span className="text-[10px] font-mono text-cyan-400">{ambientLight}%</span>
          </div>

          <button
            onClick={() => setForceRotateLandscape((prev) => !prev)}
            className={`p-2 rounded-xl border transition-all ${
              forceRotateLandscape
                ? 'bg-blue-600 border-cyan-400 text-white'
                : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Girar Tela"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowChat((prev) => !prev)}
            className={`relative p-2 rounded-xl border transition-all ${
              showChat
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-cyan-400 text-white shadow-lg shadow-blue-950'
                : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Chat ao Vivo"
          >
            <MessageSquare className="w-4 h-4" />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-black" />
            )}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600 text-white transition-all border border-slate-700"
            title="Sair do Modo Cinema (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Video Screen */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden z-20">
        {isYouTube && youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=${
              videoState.isPlaying ? 1 : 0
            }&enablejsapi=1&controls=1&modestbranding=1&rel=0`}
            title={videoState.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            webkit-playsinline="true"
            preload="auto"
            crossOrigin="anonymous"
            onClick={handleTogglePlay}
            className="w-full h-full object-contain cursor-pointer transition-transform duration-200"
          />
        )}

        {/* Theater Seats Silhouette with Blue Backlight */}
        <div
          className="absolute bottom-0 left-0 right-0 h-12 md:h-16 pointer-events-none opacity-30 flex items-end justify-around px-8"
          style={{
            background: 'linear-gradient(to top, rgba(5,8,20,0.95), transparent)',
          }}
        >
          {spectators.map((s, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <span className="text-xl md:text-2xl filter drop-shadow opacity-70">{s.avatar || '🍿'}</span>
              <div className="w-8 md:w-12 h-3 bg-blue-950/80 rounded-t-lg border-t border-blue-600/50" />
            </div>
          ))}
        </div>

        {/* Floating Chat Panel */}
        {showChat && (
          <div className="absolute right-4 top-4 bottom-24 w-80 max-w-[85vw] bg-slate-950/95 border border-blue-900/60 rounded-2xl p-3 flex flex-col shadow-2xl backdrop-blur-xl z-50 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-950">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Chat da Sala ({spectators.length}/5)
              </span>
              <button
                onClick={() => setShowChat(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-2 rounded-xl text-xs ${
                    m.isSystem
                      ? 'bg-blue-950/40 border border-blue-500/20 text-cyan-200'
                      : 'bg-slate-900 border border-blue-950 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1 font-bold text-cyan-400 text-[11px] mb-0.5">
                    <span>{m.avatar}</span>
                    <span>{m.userName}</span>
                  </div>
                  <p className="break-words">{m.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleChatSubmit} className="mt-2 pt-2 border-t border-blue-950 flex gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Mensagem..."
                className="flex-1 bg-slate-900 border border-blue-900/80 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl text-xs font-bold"
              >
                Enviar
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Bottom HUD Bar */}
      <div
        className={`relative z-40 p-4 md:p-6 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 ${
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline */}
        <div className="relative mb-3 flex items-center group/bar">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={localTime}
            onChange={(e) => {
              if (!canControl) return;
              const t = parseFloat(e.target.value);
              setLocalTime(t);
              onSeek(t);
            }}
            disabled={!canControl}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:h-2.5 transition-all"
          />
          <div
            className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 rounded-lg pointer-events-none"
            style={{ width: `${(localTime / (duration || 1)) * 100}%` }}
          />
        </div>

        {/* Controls and Reactions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleTogglePlay}
              disabled={!canControl}
              className={`p-3 rounded-2xl text-white font-bold transition-all ${
                canControl
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-950'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {videoState.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !videoRef.current.muted;
                  setIsMuted(videoRef.current.muted);
                }
              }}
              className="text-slate-300 hover:text-white p-2 rounded-xl bg-slate-900/80 border border-blue-900"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-cyan-400" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
            </button>
          </div>

          {/* Center Reactions */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-2xl border border-blue-900/60 backdrop-blur-md shadow-xl">
            <span className="text-[10px] font-bold text-cyan-300 px-2 uppercase tracking-wider hidden md:inline">
              Reações:
            </span>
            {reactionEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSendReaction(emoji)}
                className="w-8 h-8 md:w-9 md:h-9 rounded-xl hover:bg-blue-600/30 active:scale-125 transition-transform flex items-center justify-center text-lg md:text-xl"
                title={`Reagir ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-blue-600 border border-blue-900 hover:border-cyan-400 text-xs font-bold text-slate-200 hover:text-white transition-all shadow-md"
          >
            Voltar ao Painel
          </button>
        </div>
      </div>
    </div>
  );
};
