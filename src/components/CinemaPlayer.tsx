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
  Tv,
  Film,
  Gauge,
  Radio,
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
  const hlsRef = useRef<Hls | null>(null);

  const [localCurrentTime, setLocalCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(videoState.duration || 0);
  const [volume, setVolume] = useState<number>(0.95);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [isTurboMode, setIsTurboMode] = useState<boolean>(false);
  const [needsUserGesture, setNeedsUserGesture] = useState<boolean>(false);

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

  // Source loader (HTML5 / HLS)
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

  // Sync playback state
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

    if (!canControl) return;
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
    if (!canControl) return;
    const time = parseFloat(e.target.value);
    setLocalCurrentTime(time);
    onSeek(time);
  };

  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoState.isPlaying) setShowControls(false);
    }, 3500);
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

  return (
    <div
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
      className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden bg-black shadow-2xl border border-blue-900/40 group select-none"
    >
      {/* Blue Gradient Ambilight Glow */}
      <div className="absolute -inset-1 pointer-events-none transition-opacity duration-500 blur-2xl opacity-45 bg-gradient-to-tr from-blue-600/30 via-indigo-600/25 to-cyan-500/25 z-0" />

      {/* Top Header Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-black/95 via-black/60 to-transparent transition-opacity duration-300 flex items-center justify-between gap-2 ${
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
          {/* Turbo Smooth Toggle */}
          <button
            onClick={() => setIsTurboMode((prev) => !prev)}
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
              isTurboMode
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Modo Turbo: Máxima Fluidez 60FPS"
          >
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>TURBO 60FPS</span>
          </button>

          {/* BOTÃO DE CINEMA (Blue Gradient) */}
          <button
            onClick={onOpenCinemaMode}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-black shadow-lg shadow-blue-950 transition-all transform active:scale-95 border border-cyan-400/40"
            title="Preencher tela e ativar Modo Cinema"
          >
            <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="tracking-wide font-sans">MODO CINEMA</span>
          </button>
        </div>
      </div>

      {/* Floating Spectator Reactions */}
      <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
        {floatingReactions.map((rx) => (
          <div
            key={rx.id}
            className="absolute bottom-16 flex flex-col items-center animate-cinema-float"
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
            webkit-playsinline="true"
            preload="auto"
            crossOrigin="anonymous"
            onClick={handleTogglePlay}
            style={getQualityStyle(videoState.qualityPreset)}
            className="w-full h-full object-contain cursor-pointer transition-all duration-200"
          />
        )}

        {/* Autoplay blocked resolver banner */}
        {needsUserGesture && (
          <div
            onClick={handleUserTapToSync}
            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-30 cursor-pointer p-4 text-center animate-fadeIn"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-2xl shadow-xl shadow-blue-950/80 mb-3 animate-bounce">
              <Play className="w-8 h-8 fill-current ml-1" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-white">
              O Host iniciou o filme!
            </h3>
            <p className="text-xs text-cyan-300 mt-1">
              Toque aqui para desmutar e sincronizar em Ultra Qualidade
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

        {/* Center Play Button when paused */}
        {!videoState.isPlaying && !isYouTube && !needsUserGesture && (
          <button
            onClick={handleTogglePlay}
            disabled={!canControl}
            className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-2xl shadow-blue-950 border-2 border-white/50 transition-transform transform hover:scale-110 active:scale-95 z-20"
          >
            <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-current ml-1" />
          </button>
        )}
      </div>

      {/* Bottom Controls Bar (Blue Gradient Style) */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 p-2.5 sm:p-4 bg-gradient-to-t from-black via-black/85 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Bar with Blue Gradient */}
        <div className="relative mb-2 sm:mb-3 flex items-center group/bar">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={localCurrentTime}
            onChange={handleSeekChange}
            disabled={!canControl}
            className="w-full h-2 sm:h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
          />
          <div
            className="absolute top-0 left-0 h-2 sm:h-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 pointer-events-none"
            style={{ width: `${(localCurrentTime / (duration || 1)) * 100}%` }}
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play/Pause */}
            <button
              onClick={handleTogglePlay}
              disabled={!canControl}
              className={`p-2 rounded-xl text-white transition-all ${
                canControl
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-950'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title={canControl ? (videoState.isPlaying ? 'Pausar' : 'Reproduzir') : 'Apenas o Host pode controlar'}
            >
              {videoState.isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
            </button>

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

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!canControl && (
              <span className="text-[10px] font-medium text-cyan-300/90 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 hidden sm:inline">
                Sincronizado com o Host
              </span>
            )}

            <button
              onClick={onOpenCinemaMode}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white transition-all"
              title="Modo Cinema Tela Cheia"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
