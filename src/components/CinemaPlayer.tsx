import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VideoState, QualityPreset, FloatingReaction, Spectator } from '../types/cinema';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Sparkles,
  Zap,
  Sliders,
  Tv,
  Film,
  RotateCcw,
  Volume1,
} from 'lucide-react';
import { extractYouTubeId } from '../services/videoPresets';

interface CinemaPlayerProps {
  videoState: VideoState;
  isAdmin: boolean;
  canControl: boolean;
  floatingReactions: FloatingReaction[];
  spectators: Spectator[];
  onPlay: (currentTime?: number) => void;
  onPause: (currentTime?: number) => void;
  onSeek: (time: number) => void;
  onOpenCinemaMode: () => void;
  onChangeQuality: (preset: QualityPreset) => void;
}

export const CinemaPlayer: React.FC<CinemaPlayerProps> = ({
  videoState,
  isAdmin,
  canControl,
  floatingReactions,
  spectators,
  onPlay,
  onPause,
  onSeek,
  onOpenCinemaMode,
  onChangeQuality,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ambilightRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const [localCurrentTime, setLocalCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(videoState.duration || 0);
  const [volume, setVolume] = useState<number>(0.9);
  const [audioBoost, setAudioBoost] = useState<number>(100); // 100% to 300%
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [ambilightColor, setAmbilightColor] = useState<string>('rgba(225, 29, 72, 0.25)');
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);

  const controlsTimeoutRef = useRef<any>(null);
  const lastSyncTimeRef = useRef<number>(0);

  // Setup Web Audio Gain Booster
  const setupAudioBoost = useCallback(() => {
    if (!videoRef.current || audioContextRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const source = ctx.createMediaElementSource(videoRef.current);
        const gain = ctx.createGain();
        gain.gain.value = audioBoost / 100;
        source.connect(gain);
        gain.connect(ctx.destination);
        audioContextRef.current = ctx;
        gainNodeRef.current = gain;
      }
    } catch (e) {
      // Browsers may restrict cross-origin media audio nodes
    }
  }, [audioBoost]);

  // Adjust audio gain
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = audioBoost / 100;
    }
  }, [audioBoost]);

  // Format seconds to mm:ss or hh:mm:ss
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

  // Load Video source (HTML5 / HLS)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoState.url, videoState.format]);

  // Handle Play/Pause sync from WebSocket
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const serverNow = Date.now();
    const elapsedSinceUpdate = (serverNow - videoState.updatedAt) / 1000;
    const expectedTime = videoState.isPlaying
      ? videoState.currentTime + (elapsedSinceUpdate > 0 ? elapsedSinceUpdate : 0)
      : videoState.currentTime;

    const drift = Math.abs(video.currentTime - expectedTime);

    if (drift > 1.2) {
      video.currentTime = Math.max(0, expectedTime);
    }

    if (videoState.isPlaying) {
      if (video.paused) {
        video.play().catch((err) => {
          console.warn('Auto-play blocked, user interaction required:', err);
        });
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [videoState.isPlaying, videoState.currentTime, videoState.updatedAt]);

  // Track time updates & Ambilight color sampling
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setLocalCurrentTime(video.currentTime);
      if (!duration && video.duration) {
        setDuration(video.duration);
      }
    };

    const handleLoadedMetadata = () => {
      if (video.duration) {
        setDuration(video.duration);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    // Ambilight color sampler loop
    const ambilightInterval = setInterval(() => {
      if (video.paused || video.ended || !canvasRef.current) return;
      try {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, 4, 4);
          const pixel = ctx.getImageData(2, 2, 1, 1).data;
          setAmbilightColor(`rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, 0.45)`);
        }
      } catch (e) {
        // Cross origin canvas restriction guard
      }
    }, 400);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      clearInterval(ambilightInterval);
    };
  }, [duration]);

  // Video click toggle
  const handleTogglePlay = () => {
    setupAudioBoost();
    if (!canControl) return;
    if (videoState.isPlaying) {
      onPause(videoRef.current ? videoRef.current.currentTime : localCurrentTime);
    } else {
      onPlay(videoRef.current ? videoRef.current.currentTime : localCurrentTime);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControl) return;
    const time = parseFloat(e.target.value);
    setLocalCurrentTime(time);
    onSeek(time);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoState.isPlaying) setShowControls(false);
    }, 3500);
  };

  // Quality Preset Filter Classes
  const getQualityStyle = (preset: QualityPreset): React.CSSProperties => {
    switch (preset) {
      case 'ultra_4k':
        return {
          filter: 'contrast(1.12) saturate(1.18) brightness(1.02)',
        };
      case 'hdr_vibrant':
        return {
          filter: 'contrast(1.22) saturate(1.35) brightness(1.05)',
        };
      case 'crisp_sharp':
        return {
          filter: 'contrast(1.18) saturate(1.08) drop-shadow(0 0 1px rgba(255,255,255,0.3))',
        };
      case 'cyberpunk':
        return {
          filter: 'contrast(1.25) saturate(1.4) hue-rotate(8deg)',
        };
      case 'night_mode':
        return {
          filter: 'contrast(1.05) brightness(0.88) sepia(0.12)',
        };
      case 'original':
      default:
        return {};
    }
  };

  const qualityLabels: Record<QualityPreset, { label: string; desc: string; icon: string }> = {
    ultra_4k: { label: 'Ultra 4K Remaster', desc: 'Nitidez inteligente & Realce de Cores', icon: '✨' },
    hdr_vibrant: { label: 'HDR Super Vibrante', desc: 'Contraste dinâmico e cores cinematográficas', icon: '🌈' },
    crisp_sharp: { label: 'Nitidez Extrema', desc: 'Realce de bordas para telas grandes', icon: '🔍' },
    cyberpunk: { label: 'Modo Neon Cyberpunk', desc: 'Graduação de cor estilizada e rica', icon: '⚡' },
    night_mode: { label: 'Modo Noturno Confort', desc: 'Reduz fadiga visual em quartos escuros', icon: '🌙' },
    original: { label: 'Original Sem Filtro', desc: 'Perfil de cor padrão da fonte', icon: '🎞️' },
  };

  const isYouTube = videoState.format === 'youtube' || videoState.url.includes('youtube.com') || videoState.url.includes('youtu.be');
  const youtubeId = isYouTube ? extractYouTubeId(videoState.url) : null;

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative w-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-slate-800 group"
      style={{
        boxShadow: `0 20px 50px -10px ${ambilightColor}, 0 0 30px rgba(0,0,0,0.8)`,
      }}
    >
      {/* Hidden canvas for Ambilight extraction */}
      <canvas ref={canvasRef} width={4} height={4} className="hidden" />

      {/* Ambilight glow backdrop */}
      <div
        ref={ambilightRef}
        className="absolute -inset-4 pointer-events-none transition-all duration-700 blur-3xl opacity-60 z-0"
        style={{
          background: `radial-gradient(circle at center, ${ambilightColor} 0%, transparent 75%)`,
        }}
      />

      {/* Top Header Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 flex items-center justify-between ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-600/30 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-inner">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-white tracking-wide truncate max-w-xs md:max-w-md">
              {videoState.title || 'Filme em Exibição'}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ● AO VIVO SINCRONIZADO
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {videoState.qualityPreset.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons (Modo Cinema & Qualidade) */}
        <div className="flex items-center gap-2">
          {/* Quality Selector Button */}
          <div className="relative">
            <button
              onClick={() => setShowQualityMenu((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-rose-300 transition-all shadow-lg hover:border-rose-500/50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Qualidade 4K</span>
            </button>

            {showQualityMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-slate-950/95 border border-slate-800 rounded-xl p-2 shadow-2xl z-50 backdrop-blur-xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 border-b border-slate-800">
                  Filtros de Pós-Processamento 4K
                </p>
                <div className="space-y-1 mt-1">
                  {(Object.keys(qualityLabels) as QualityPreset[]).map((key) => {
                    const info = qualityLabels[key];
                    const isSelected = videoState.qualityPreset === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          onChangeQuality(key);
                          setShowQualityMenu(false);
                        }}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all ${
                          isSelected
                            ? 'bg-rose-600/20 border border-rose-500/40 text-white'
                            : 'hover:bg-slate-900 text-slate-300'
                        }`}
                      >
                        <span className="text-base mt-0.5">{info.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            {info.label}
                            {isSelected && <span className="text-[10px] text-rose-400">● Ativo</span>}
                          </p>
                          <p className="text-[10px] text-slate-400 leading-tight">{info.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* BOTÃO DE CINEMA (Fullscreen / Landscape Mode) */}
          <button
            onClick={onOpenCinemaMode}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs md:text-sm font-bold shadow-lg shadow-rose-900/50 transition-all transform hover:scale-105 active:scale-95 border border-rose-400/30"
            title="Preencher tela e ativar Modo Cinema paisagem"
          >
            <Tv className="w-4 h-4" />
            <span>MODO CINEMA</span>
          </button>
        </div>
      </div>

      {/* Floating spectator reactions on screen */}
      <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
        {floatingReactions.map((rx) => (
          <div
            key={rx.id}
            className="absolute bottom-16 flex flex-col items-center animate-cinema-float"
            style={{ left: `${rx.x}%` }}
          >
            <span className="text-3xl md:text-5xl filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
              {rx.emoji}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white border border-white/20 mt-1 whitespace-nowrap">
              {rx.userName}
            </span>
          </div>
        ))}
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-video w-full flex items-center justify-center bg-black z-10">
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
            crossOrigin="anonymous"
            onClick={handleTogglePlay}
            style={getQualityStyle(videoState.qualityPreset)}
            className="w-full h-full object-contain cursor-pointer transition-all duration-300"
          />
        )}

        {/* Buffering Indicator */}
        {isBuffering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20 pointer-events-none">
            <div className="w-12 h-12 rounded-full border-4 border-rose-500 border-t-transparent animate-spin mb-3 shadow-lg" />
            <p className="text-xs font-mono text-rose-300 font-bold tracking-widest uppercase animate-pulse">
              Buffering Ultra 4K...
            </p>
          </div>
        )}

        {/* Center Play Button Overlay when paused */}
        {!videoState.isPlaying && !isYouTube && (
          <button
            onClick={handleTogglePlay}
            disabled={!canControl}
            className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-950 border-2 border-white/40 transition-transform transform hover:scale-110 active:scale-95 z-20"
          >
            <Play className="w-9 h-9 fill-current ml-1" />
          </button>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 p-3 md:p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Scrubber */}
        <div className="relative mb-3 flex items-center group/bar">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={localCurrentTime}
            onChange={handleSeekChange}
            disabled={!canControl}
            className="w-full h-1.5 bg-slate-700/70 rounded-lg appearance-none cursor-pointer accent-rose-500 focus:outline-none hover:h-2.5 transition-all"
          />
          {/* Progress visual bar */}
          <div
            className="absolute top-0 left-0 h-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-500 pointer-events-none group-hover/bar:h-2.5 transition-all"
            style={{ width: `${(localCurrentTime / (duration || 1)) * 100}%` }}
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Play/Pause */}
            <button
              onClick={handleTogglePlay}
              disabled={!canControl}
              className={`p-2 rounded-xl text-white transition-all ${
                canControl
                  ? 'bg-slate-800 hover:bg-rose-600 hover:shadow-lg hover:shadow-rose-900/50'
                  : 'bg-slate-900/50 text-slate-500 cursor-not-allowed'
              }`}
              title={canControl ? (videoState.isPlaying ? 'Pausar' : 'Reproduzir') : 'Apenas o Admin pode controlar'}
            >
              {videoState.isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5" /> : <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />}
            </button>

            {/* Timestamps */}
            <div className="text-xs font-mono text-slate-300">
              <span className="text-white font-bold">{formatTime(localCurrentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Volume & Audio Gain Booster */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !videoRef.current.muted;
                    setIsMuted(videoRef.current.muted);
                  }
                }}
                className="text-slate-300 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : volume > 0.5 ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <Volume1 className="w-4 h-4" />
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
                className="w-16 md:w-20 h-1 bg-slate-700 rounded-lg appearance-none accent-rose-500 cursor-pointer"
              />

              {/* Volume Booster (300%) */}
              <button
                onClick={() => {
                  setupAudioBoost();
                  setAudioBoost((prev) => (prev >= 300 ? 100 : prev + 50));
                }}
                className={`hidden sm:flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-all ${
                  audioBoost > 100
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Amplificador de Volume (Web Audio Boost)"
              >
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                <span>BOOST {audioBoost}%</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!canControl && (
              <span className="hidden sm:inline-block text-[11px] font-medium text-amber-300/80 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                Modo Espectador: Sincronizado com Admin
              </span>
            )}

            {/* Quick Cinema Fullscreen */}
            <button
              onClick={onOpenCinemaMode}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all hover:scale-105"
              title="Tela Cheia / Modo Cinema"
            >
              <Maximize className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
