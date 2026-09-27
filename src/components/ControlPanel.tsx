import React, { useState } from 'react';
import { CinemaRoomState, Spectator, QualityPreset } from '../types/cinema';
import { VIDEO_PRESETS, VideoPreset, detectMediaFormat } from '../services/videoPresets';
import {
  Film,
  Link,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Shield,
  Crown,
  UserX,
  Share2,
  Copy,
  Check,
  Megaphone,
  SlidersHorizontal,
  Lock,
  Unlock,
  Radio,
  Tv,
} from 'lucide-react';

interface ControlPanelProps {
  roomState: CinemaRoomState;
  currentUser: Spectator | null;
  isAdmin: boolean;
  canControl: boolean;
  onChangeMedia: (url: string, title?: string, duration?: number) => void;
  onPlay: (time?: number) => void;
  onPause: (time?: number) => void;
  onSeek: (time: number) => void;
  onChangeQuality: (preset: QualityPreset) => void;
  onAdminAction: (action: 'kick' | 'transfer_admin' | 'set_announcement' | 'toggle_admin_control', targetUserId?: string, value?: any) => void;
  onOpenCinemaMode: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  roomState,
  currentUser,
  isAdmin,
  canControl,
  onChangeMedia,
  onPlay,
  onPause,
  onSeek,
  onChangeQuality,
  onAdminAction,
  onOpenCinemaMode,
}) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const [announcementText, setAnnouncementText] = useState(roomState.announcement || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  const handleMediaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    onChangeMedia(videoUrl.trim(), videoTitle.trim() || 'Filme Selecionado');
    setVideoUrl('');
    setVideoTitle('');
  };

  const handleLoadPreset = (preset: VideoPreset) => {
    onChangeMedia(preset.url, preset.title, preset.duration);
  };

  const handleCopyInvite = () => {
    const text = `🎬 Convite CineRoom Ultra 4K!\n📍 IP da Porta: ${roomState.ipPort}\n🔒 Senha: (solicite ao host)\n🍿 Capacidade: Máximo 5 espectadores\nAssista comigo em Ultra Qualidade!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const categories = ['Todos', 'Cinema 4K', 'Trailer Sci-Fi', 'Animação 4K', 'Cyberpunk', 'Transmissão Ao Vivo (HLS)'];

  const filteredPresets = selectedCategory === 'Todos'
    ? VIDEO_PRESETS
    : VIDEO_PRESETS.filter((p) => p.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Top Banner / Announcement */}
      {roomState.announcement && (
        <div className="bg-gradient-to-r from-rose-950/60 via-purple-950/50 to-slate-900 border border-rose-500/30 rounded-2xl p-3.5 flex items-center justify-between shadow-lg shadow-rose-950/30">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="p-2 rounded-xl bg-rose-600/30 text-rose-400">
              <Megaphone className="w-4 h-4 animate-bounce" />
            </span>
            <p className="text-xs md:text-sm font-semibold text-rose-200 truncate">
              {roomState.announcement}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => onAdminAction('set_announcement', undefined, null)}
              className="text-[11px] text-rose-400 hover:text-white underline ml-2 whitespace-nowrap"
            >
              Remover
            </button>
          )}
        </div>
      )}

      {/* Main Admin Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Video Source Loader & Quick Library */}
        <div className="lg:col-span-2 space-y-6">
          {/* Admin Video Input Panel */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                    Painel do Admin: Carregar Vídeo / Filme
                    {isAdmin && <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">HOST</span>}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Insira link direto (MP4, MKV, WebM), transmissão HLS (.m3u8) ou YouTube
                  </p>
                </div>
              </div>

              {/* Botão de Cinema Direct Shortcut */}
              <button
                onClick={onOpenCinemaMode}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/60 transition-transform active:scale-95"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Modo Cinema Paisagem</span>
              </button>
            </div>

            {isAdmin ? (
              <form onSubmit={handleMediaSubmit} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 relative">
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Cole o link do vídeo ou filme (ex: https://.../filme.mp4)"
                      required
                      className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono transition-all"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="Título do Filme (opcional)"
                      className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Formatos aceitos:</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">MP4 4K</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">HLS .m3u8</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">YouTube</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">WebM</span>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-950 transition-all active:scale-95"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Reproduzir em Ultra Qualidade</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-center">
                <Shield className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold text-slate-300">
                  Painel de reprodução restrito ao Administrador ({roomState.adminName}).
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Você está sincronizado na Poltrona {currentUser ? currentUser.seatIndex + 1 : 1}.
                </p>
              </div>
            )}
          </div>

          {/* Quick 4K Presets Library */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Biblioteca Ultra HD 4K (Demos Prontos)
                </h3>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="group relative bg-slate-950/70 border border-slate-800/80 hover:border-rose-500/50 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-rose-950/30 flex flex-col"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                    <img
                      src={preset.thumbnail}
                      alt={preset.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-85 group-hover:opacity-100"
                    />
                    <div className="absolute top-2 left-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600 text-white shadow">
                        {preset.qualityTag}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 line-clamp-1 group-hover:text-rose-300 transition-colors">
                        {preset.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-slate-500">{preset.category}</span>
                      {isAdmin ? (
                        <button
                          onClick={() => handleLoadPreset(preset)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-bold transition-all border border-rose-500/40 flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Carregar</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Sugestão</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Room Details, Invite & Spectator Management */}
        <div className="space-y-6">
          {/* Room IP/Port & Access Info Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Identificação da Porta
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                SALA ATIVA
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">IP da Porta</p>
                <p className="text-sm md:text-base font-mono font-bold text-rose-400 tracking-wider">
                  {roomState.ipPort}
                </p>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Capacidade da Sessão</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-bold text-white">
                    {roomState.spectators.length} de {roomState.maxUsers} Poltronas Ocupadas
                  </p>
                  <span className="text-[10px] font-mono text-rose-400 font-bold">
                    Máx: 5 Pessoas
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                    style={{ width: `${(roomState.spectators.length / roomState.maxUsers) * 100}%` }}
                  />
                </div>
              </div>

              {/* Copy Invite Link */}
              <button
                onClick={handleCopyInvite}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-rose-400" />}
                <span>{copied ? 'Dados Copiados!' : 'Copiar IP da Porta e Senha'}</span>
              </button>
            </div>

            {/* Host Administration Tools */}
            {isAdmin && (
              <div className="mt-5 pt-4 border-t border-slate-800 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Configurações do Host
                </p>

                {/* Announcement input */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold">Mensagem no Topo (Aviso)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="Ex: Silêncio na sala! Filme começando..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      onClick={() => onAdminAction('set_announcement', undefined, announcementText)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                {/* Control Permission toggle */}
                <button
                  onClick={() => onAdminAction('toggle_admin_control', undefined, !roomState.adminOnlyControl)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                    roomState.adminOnlyControl
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {roomState.adminOnlyControl ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    <span>Controle Apenas do Admin</span>
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/40">
                    {roomState.adminOnlyControl ? 'ATIVADO' : 'LIBERADO'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Spectators Detailed List & Management */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Espectadores na Sala ({roomState.spectators.length}/5)
              </h3>
              <span className="text-[10px] text-slate-400">Tempo Real</span>
            </div>

            <div className="space-y-2">
              {roomState.spectators.map((spectator) => {
                const isMe = spectator.id === currentUser?.id;
                return (
                  <div
                    key={spectator.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${
                      isMe
                        ? 'bg-rose-950/30 border-rose-500/30'
                        : 'bg-slate-950/60 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{spectator.avatar || '🍿'}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          {spectator.name} {isMe && <span className="text-[10px] text-rose-400">(Você)</span>}
                          {spectator.isAdmin && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-500 text-black flex items-center gap-0.5">
                              <Crown className="w-2 h-2 fill-current" />
                              HOST
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          Poltrona {spectator.seatIndex + 1} • {spectator.ping || 24}ms
                        </p>
                      </div>
                    </div>

                    {/* Admin Actions on other spectators */}
                    {isAdmin && !isMe && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onAdminAction('transfer_admin', spectator.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-600/30 text-amber-300 text-[10px] border border-slate-700"
                          title="Passar cargo de Host"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onAdminAction('kick', spectator.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-rose-400 text-[10px] border border-slate-700"
                          title="Remover espectador da sala"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
