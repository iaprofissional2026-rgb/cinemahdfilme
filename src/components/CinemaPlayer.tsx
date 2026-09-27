import React, { useEffect, useRef, useState } from 'react';
import { VideoState, QualityPreset, FloatingReaction, Spectator, ChatMessage } from '../types/cinema';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Tv,
  Film,
  Gauge,
  Radio,
  Lock,
  ShieldCheck,
  X,
  MessageSquare,
  Moon,
  Smartphone,
  RotateCw,
  Send,
} from 'lucide-react';
import { extractYouTubeId } from '../services/videoPresets';

interface CinemaPlayerProps {
  videoState: VideoState;
  isAdmin: boolean;
  canControl: boolean;
  floatingReactions: FloatingReaction[];
  spectators: Spectator[];
  messages: ChatMessage[];
  isCinemaMode: boolean;
  onToggleCinemaMode: () => void;
  onPlay: (currentTime?: number) => void;
  onPause: (currentTime?: number) => void;
  onSeek: (time: number) => void;
  onChangeQuality: (preset: QualityPreset) => void;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
}

export const CinemaPlayer: React.FC<CinemaPlayerProps> = ({
  videoState,
  isAdmin,
  floatingReactions,
  spectators,
  messages,
  isCinemaMode,
  onToggleCinemaMode,
  onPlay,
  onPause,
  onSeek,
  onSendMessage,
  onSendReaction,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [localCurrentTime, setLocalCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(videoState.duration || 0);
  const [volume, setVolume] = useState<number>(0.95);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isTurboMode, setIsTurboMode] = useState<boolean>(false);
  const [needsUserGesture, setNeedsUserGesture] = useState<boolean>(false);
  const [showChatInCinema, setShowChatInCinema] = useState<boolean>(false);
  const [cinemaChatInput, setCinemaChatInput] = useState<string>('');
  const [forceLandscape, setForceLandscape] = useState<boolean>(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  const controlsTimeoutRef = useRef<any>(null);
  const currentLoadedUrlRef = useRef<string>('');

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Orientation check
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        setIsPortrait(window.innerHeight > window.innerWidth);
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

  // Request fullscreen and orientation lock when Cinema Mode is activated
  useEffect(() => {
    if (isCinemaMode) {
      const elem = containerRef.current || document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      }

      if (typeof screen !== 'undefined' && screen.orientation && (screen.orientation as any).lock) {
        (screen.orientation as any).lock('landscape').catch(() => {});
      }

      // Auto-hide controls in 3 seconds
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showChatInCinema) {
          setShowControls(false);
        }
      }, 3000);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setShowControls(true);
    }
  }, [isCinemaMode, showChatInCinema]);

  // Load Source (HTML5 or HLS) - SINGLE CONTINUOUS PLAYER INSTANCE
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoState.url) return;

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
        backBufferLength: 60,
      });
      hls.loadSource(videoState.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (videoState.isPlaying) {
          video.play().catch(() => {
            setNeedsUserGesture(true);
          });
        }
      });
      hlsRef.current = hls;
    } else {
      video.src = videoState.url;
      video.load();
      if (videoState.isPlaying) {
        video.play().catch(() => {
          setNeedsUserGesture(true);
        });
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoState.url, videoState.format, videoState.isPlaying]);

  // Sync playback state strictly with Admin
  useEffect(() => {
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
        video.play().then(() => {
          setNeedsUserGesture(false);
        }).catch(() => {
          setNeedsUserGesture(true);
        });
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [videoState.isPlaying, videoState.currentTime, videoState.updatedAt]);

  // Time listener & buffer state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setLocalCurrentTime(video.currentTime);
      if (!duration && video.duration) setDuration(video.duration);
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setNeedsUserGesture(false);
    };
    const handleLoadedMetadata = () => {
      if (video.duration) setDuration(video.duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [duration]);

  const handleTogglePlay = () => {
    if (needsUserGesture) {
      if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.play().then(() => {
          setNeedsUserGesture(false);
        }).catch(() => {});
      }
      return;
    }

    // STRICT: Only Admin can pause / unpause
    if (!isAdmin) {
      return;
    }

    const time = videoRef.current ? videoRef.current.currentTime : localCurrentTime;
    if (videoState.isPlaying) {
      onPause(time);
    } else {
      onPlay(time);
    }
  };

  const handleUserTapToSync = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().then(() => {
        setNeedsUserGesture(false);
      }).catch(() => {});
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const time = parseFloat(e.target.value);
    setLocalCurrentTime(time);
    onSeek(time);
  };

  // 3-SECOND AUTO HIDE ON MOUSE / TOUCH ACTIVITY
  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoState.isPlaying && !showChatInCinema) {
        setShowControls(false);
      }
    }, 3000);
  };

  const handleCinemaChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cinemaChatInput.trim()) return;
    onSendMessage(cinemaChatInput.trim());
    setCinemaChatInput('');
  };

  const getQualityStyle = (preset: QualityPreset): React.CSSProperties => {
    if (isTurboMode) {
      return { transform: 'translate3d(0,0,0)' };
    }
    switch (preset) {
      case 'ultra_4k':
        return {
          filter: 'contrast(1.08) saturate(1.15) brightness(1.02)',
          transform: 'translate3d(0,0,0)',
        };
      case 'hdr_vibrant':
        return {
          filter: 'contrast(1.16) saturate(1.28) brightness(1.04)',
          transform: 'translate3d(0,0,0)',
        };
      case 'crisp_sharp':
        return {
          filter: 'contrast(1.12) saturate(1.08)',
          transform: 'translate3d(0,0,0)',
        };
      case 'cyberpunk':
        return {
          filter: 'contrast(1.2) saturate(1.35) hue-rotate(6deg)',
          transform: 'translate3d(0,0,0)',
        };
      case 'original':
      default:
        return { transform: 'translate3d(0,0,0)' };
    }
  };

  const isYouTube = videoState.format === 'youtube' || videoState.url.includes('youtube.com') || videoState.url.includes('youtu.be');
  const youtubeId = isYouTube ? extractYouTubeId(videoState.url) : null;
  const reactionEmojis = ['🍿', '👏', '🔥', '😂', '😱', '❤️', '🍻', '🎬'];

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
      className={`group select-none overflow-hidden transition-all duration-300 ${
        isCinemaMode
          ? `fixed inset-0 z-[9999] w-screen h-screen bg-black flex flex-col justify-between ${
              forceLandscape
                ? 'origin-center rotate-90 w-[100vh] h-[100vw] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                : ''
            }`
          : 'relative w-full rounded-2xl md:rounded-3xl bg-black shadow-2xl border border-blue-900/40'
      }`}
    >
      {/* Blue Gradient Ambilight Glow */}
      <div className="absolute -inset-1 pointer-events-none transition-opacity duration-500 blur-2xl opacity-45 bg-gradient-to-tr from-blue-600/30 via-indigo-600/25 to-cyan-500/25 z-0" />

      {/* Mobile Landscape Alert in Cinema Mode */}
      {isCinemaMode && isPortrait && !forceLandscape && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 border border-cyan-400/40 text-white px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce">
          <Smartphone className="w-5 h-5 rotate-90 animate-pulse text-cyan-300" />
          <div className="text-xs">
            <p className="font-bold">Gire o celular para Modo Paisagem!</p>
            <p className="text-[10px] text-cyan-100">Ou force o giro 90° abaixo</p>
          </div>
          <button
            onClick={() => setForceLandscape(true)}
            className="px-2 py-1 bg-white text-blue-800 rounded-lg font-bold text-[10px] uppercase shadow"
          >
            Girar 90°
          </button>
        </div>
      )}

      {/* TOP HEADER CONTROLS (Auto-hides in 3s on Cinema Mode) */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 p-3 sm:p-5 bg-gradient-to-b from-black/95 via-black/60 to-transparent transition-opacity duration-500 flex items-center justify-between gap-2 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 border border-blue-400/40 flex items-center justify-center text-white flex-shrink-0 shadow-md">
            <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="truncate min-w-0">
            <h2 className="text-xs sm:text-sm font-black text-white tracking-wide truncate">
              {videoState.title || 'Filme em Exibição'}
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse text-cyan-400" />
                AO VIVO SINCRONIZADO
              </span>
              <span className="text-[9px] font-mono text-blue-300/80 uppercase hidden xs:inline">
                {videoState.qualityPreset}
              </span>
            </div>
          </div>
        </div>

        {/* Quality & Cinema Mode Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {isCinemaMode && (
            <>
              {/* Rotate toggle in cinema mode */}
              <button
                onClick={() => setForceLandscape((prev) => !prev)}
                className={`p-2 rounded-xl border text-xs transition-all ${
                  forceLandscape
                    ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300'
                }`}
                title="Girar Tela 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Chat toggle in cinema mode */}
              <button
                onClick={() => setShowChatInCinema((prev) => !prev)}
                className={`relative p-2 rounded-xl border text-xs transition-all ${
                  showChatInCinema
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-cyan-400 text-white'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300'
                }`}
                title="Chat"
              >
                <MessageSquare className="w-4 h-4" />
                {messages.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400" />
                )}
              </button>
            </>
          )}

          {/* Turbo Smooth Toggle */}
          <button
            onClick={() => setIsTurboMode((prev) => !prev)}
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
              isTurboMode
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Modo Turbo: 60FPS"
          >
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>TURBO 60FPS</span>
          </button>

          {/* BOTÃO DE CINEMA TOGGLE */}
          <button
            onClick={onToggleCinemaMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-black transition-all transform active:scale-95 border ${
              isCinemaMode
                ? 'bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border-cyan-500/50 shadow-lg'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg shadow-blue-950 border-cyan-400/40'
            }`}
            title={isCinemaMode ? 'Sair do Modo Cinema' : 'Ativar Modo Cinema Tela Cheia'}
          >
            {isCinemaMode ? <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" /> : <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            <span className="tracking-wide font-sans">{isCinemaMode ? 'SAIR DO CINEMA' : 'MODO CINEMA'}</span>
          </button>
        </div>
      </div>

      {/* Floating Spectator Reactions */}
      <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
        {floatingReactions.map((rx) => (
          <div
            key={rx.id}
            className="absolute bottom-20 flex flex-col items-center animate-cinema-float"
            style={{ left: `${rx.x}%` }}
          >
            <span className="text-3xl sm:text-5xl filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]">
              {rx.emoji}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-950/90 text-cyan-300 border border-cyan-500/40 mt-1 whitespace-nowrap shadow-lg">
              {rx.userName}
            </span>
          </div>
        ))}
      </div>

      {/* VIDEO VIEWPORT (STRETCHES BEAUTIFULLY IN CINEMA MODE) */}
      <div
        className={`relative flex items-center justify-center bg-black z-10 ${
          isCinemaMode ? 'w-full h-full flex-1' : 'w-full aspect-video'
        }`}
      >
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
            onClick={handleTogglePlay}
            style={getQualityStyle(videoState.qualityPreset)}
            className={`w-full h-full object-contain transition-all duration-200 ${
              isAdmin ? 'cursor-pointer' : 'cursor-default'
            }`}
          />
        )}

        {/* Floating Chat Drawer in Cinema Mode */}
        {isCinemaMode && showChatInCinema && (
          <div className="absolute right-4 top-16 bottom-24 w-80 max-w-[85vw] bg-slate-950/95 border border-blue-900/60 rounded-2xl p-3 flex flex-col shadow-2xl backdrop-blur-xl z-50 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-950">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Chat da Sala ({spectators.length}/5)
              </span>
              <button
                onClick={() => setShowChatInCinema(false)}
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

            <form onSubmit={handleCinemaChatSubmit} className="mt-2 pt-2 border-t border-blue-950 flex gap-1.5">
              <input
                type="text"
                value={cinemaChatInput}
                onChange={(e) => setCinemaChatInput(e.target.value)}
                placeholder="Mensagem..."
                className="flex-1 bg-slate-900 border border-blue-900/80 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl text-xs font-bold"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>
          </div>
        )}

        {/* Autoplay unblock button */}
        {needsUserGesture && (
          <div
            onClick={handleUserTapToSync}
            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm z-30 cursor-pointer p-4 text-center animate-fadeIn"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-2xl shadow-xl shadow-blue-950/80 mb-3 animate-bounce">
              <Play className="w-8 h-8 fill-current ml-1" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-white">
              O Admin iniciou a transmissão!
            </h3>
            <p className="text-xs text-cyan-300 mt-1">
              Toque aqui para desmutar e assistir em Ultra Qualidade
            </p>
          </div>
        )}

        {/* Buffering Indicator */}
        {isBuffering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20 pointer-events-none">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-3 border-cyan-400 border-t-transparent animate-spin mb-2" />
            <p className="text-[11px] font-mono text-cyan-300 font-bold uppercase tracking-widest animate-pulse">
              Buffer Ultra 4K...
            </p>
          </div>
        )}

        {/* Center Play Button for Admin when paused */}
        {!videoState.isPlaying && !isYouTube && !needsUserGesture && isAdmin && (
          <button
            onClick={handleTogglePlay}
            className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-2xl shadow-blue-950 border-2 border-white/50 transition-transform transform hover:scale-110 active:scale-95 z-20"
          >
            <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-current ml-1" />
          </button>
        )}

        {/* Guest info badge when paused by Admin */}
        {!videoState.isPlaying && !isAdmin && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-20">
            <div className="px-4 py-2 rounded-2xl bg-slate-950/80 border border-blue-900/60 backdrop-blur-md flex items-center gap-2 text-cyan-300 text-xs font-bold shadow-xl">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>Filme pausado pelo Administrador</span>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS BAR (Auto-hides completely in 3s on Cinema Mode) */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 p-2.5 sm:p-5 bg-gradient-to-t from-black via-black/85 to-transparent transition-opacity duration-500 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Bar */}
        <div className="relative mb-2 sm:mb-3 flex items-center group/bar">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={localCurrentTime}
            onChange={handleSeekChange}
            disabled={!isAdmin}
            className={`w-full h-2 sm:h-1.5 bg-slate-800 rounded-lg appearance-none accent-cyan-400 focus:outline-none ${
              isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
            }`}
          />
          <div
            className="absolute top-0 left-0 h-2 sm:h-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 pointer-events-none"
            style={{ width: `${(localCurrentTime / (duration || 1)) * 100}%` }}
          />
        </div>

        {/* Controls and Reactions Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play/Pause */}
            {isAdmin ? (
              <button
                onClick={handleTogglePlay}
                className="p-2 rounded-xl text-white transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-950"
                title={videoState.isPlaying ? 'Pausar Filme' : 'Iniciar Filme'}
              >
                {videoState.isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
              </button>
            ) : (
              <div
                className="p-2 rounded-xl bg-slate-900 border border-blue-950 text-slate-500 flex items-center justify-center"
                title="Controle exclusivo do Administrador"
              >
                <Lock className="w-4 h-4 text-cyan-400" />
              </div>
            )}

            {/* Timestamps */}
            <div className="text-[11px] sm:text-xs font-mono text-slate-300">
              <span className="text-cyan-300 font-bold">{formatTime(localCurrentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !videoRef.current.muted;
                    setIsMuted(videoRef.current.muted);
                  }
                }}
                className="text-slate-300 hover:text-white p-1"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-300" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = false;
                  }
                  setIsMuted(false);
                }}
                className="w-14 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none accent-cyan-400 cursor-pointer hidden xs:inline-block"
              />
            </div>
          </div>

          {/* Center Reactions (Available in Cinema Mode too!) */}
          {isCinemaMode && (
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-blue-900/60 backdrop-blur-md">
              {reactionEmojis.slice(0, 5).map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onSendReaction(emoji)}
                  className="hover:scale-125 transition-transform p-1 text-base active:scale-90"
                  title={`Reagir ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isCinemaMode && (
              isAdmin ? (
                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 flex items-center gap-1 hidden sm:flex">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" />
                  Host
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-blue-950 flex items-center gap-1 hidden sm:flex">
                  <Lock className="w-3 h-3 text-cyan-400" />
                  Admin
                </span>
              )
            )}

            <button
              onClick={onToggleCinemaMode}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white transition-all"
              title={isCinemaMode ? 'Sair do Modo Cinema' : 'Modo Cinema Tela Cheia'}
            >
              {isCinemaMode ? <X className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
