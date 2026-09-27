import React, { useState } from 'react';
import { CinemaRoomState, Spectator, QualityPreset } from '../types/cinema';
import { VIDEO_PRESETS, VideoPreset } from '../services/videoPresets';
import {
  Film,
  Play,
  Sparkles,
  Shield,
  Crown,
  UserX,
  Copy,
  Check,
  Megaphone,
  Radio,
  Tv,
  Hash,
  ShieldCheck,
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
  onChangeMedia,
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
    const text = `🎬 Convite CineRoom 4K!\n📍 ID da Sala: ${roomState.roomId || roomState.ipPort}\n🔒 Senha: (solicite ao host)\n🍿 Capacidade: Máximo 5 espectadores\nAssista comigo em Ultra Qualidade!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const categories = ['Todos', 'Cinema 4K', 'Trailer Sci-Fi', 'Animação 4K', 'Cyberpunk', 'Transmissão Ao Vivo (HLS)'];

  const filteredPresets = selectedCategory === 'Todos'
    ? VIDEO_PRESETS
    : VIDEO_PRESETS.filter((p) => p.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Top Banner / Announcement */}
      {roomState.announcement && (
        <div className="bg-gradient-to-r from-blue-950/80 via-indigo-950/60 to-slate-950 border border-blue-500/40 rounded-2xl p-3.5 flex items-center justify-between shadow-lg shadow-blue-950/40">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="p-2 rounded-xl bg-blue-600/30 text-cyan-300 border border-blue-500/30">
              <Megaphone className="w-4 h-4 animate-bounce" />
            </span>
            <p className="text-xs md:text-sm font-semibold text-cyan-200 truncate">
              {roomState.announcement}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => onAdminAction('set_announcement', undefined, null)}
              className="text-[11px] text-cyan-400 hover:text-white underline ml-2 whitespace-nowrap"
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
          <div className="bg-slate-900/90 border border-blue-900/40 rounded-2xl p-5 shadow-xl backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4 pb-3 border-b border-blue-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
                  <Film className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black text-white flex items-center gap-2">
                    Painel do Host: Transmitir Filme / Vídeo
                    {isAdmin && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950">HOST</span>}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    O Host tem controle exclusivo de pausar, despausar e trocar o filme para todos os 5 espectadores
                  </p>
                </div>
              </div>

              <button
                onClick={onOpenCinemaMode}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-950 transition-transform active:scale-95 border border-cyan-400/30"
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
                      className="w-full bg-slate-950/90 border border-blue-900/60 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono transition-all"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="Título do Filme (opcional)"
                      className="w-full bg-slate-950/90 border border-blue-900/60 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Formatos:</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 border border-blue-900 text-cyan-300">MP4 4K</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 border border-blue-900 text-cyan-300">HLS .m3u8</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 border border-blue-900 text-cyan-300">YouTube</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 border border-blue-900 text-cyan-300">WebM</span>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-black shadow-lg shadow-blue-950 transition-all active:scale-95 border border-cyan-400/30"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                    <span>Transmitir em Ultra Qualidade</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-slate-950/70 border border-blue-950 rounded-xl p-4 text-center">
                <Shield className="w-8 h-8 text-blue-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold text-slate-300">
                  Painel de reprodução restrito ao Administrador ({roomState.adminName}).
                </p>
                <p className="text-[11px] text-cyan-400/80 mt-0.5">
                  Os espectadores assistem em sincronia e não podem pausar o filme.
                </p>
              </div>
            )}
          </div>

          {/* Quick 4K Presets Library */}
          <div className="bg-slate-900/90 border border-blue-900/40 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-blue-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Biblioteca Ultra HD 4K (Demos Prontos)
                </h3>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
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
                  className="group relative bg-slate-950 border border-blue-950 hover:border-cyan-400/50 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-blue-950/40 flex flex-col"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                    <img
                      src={preset.thumbnail}
                      alt={preset.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-85 group-hover:opacity-100"
                    />
                    <div className="absolute top-2 left-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow">
                        {preset.qualityTag}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 line-clamp-1 group-hover:text-cyan-300 transition-colors">
                        {preset.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-900 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-slate-500">{preset.category}</span>
                      {isAdmin ? (
                        <button
                          onClick={() => handleLoadPreset(preset)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-cyan-300 hover:text-white text-[11px] font-bold transition-all border border-blue-500/40 flex items-center gap-1"
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
          <div className="bg-slate-900/90 border border-blue-900/40 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-blue-950">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Dados da Sala
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                SALA ATIVA
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-blue-950">
                <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Hash className="w-3 h-3 text-cyan-400" />
                  ID da Sala
                </p>
                <p className="text-sm md:text-base font-mono font-black text-cyan-400 tracking-wider">
                  {roomState.roomId || roomState.ipPort}
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-blue-950">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Capacidade da Sessão</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-bold text-white">
                    {roomState.spectators.length} de {roomState.maxUsers} Poltronas Ocupadas
                  </p>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">
                    Máx: 5
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400"
                    style={{ width: `${(roomState.spectators.length / roomState.maxUsers) * 100}%` }}
                  />
                </div>
              </div>

              <button
                onClick={handleCopyInvite}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-blue-950/60 text-slate-200 hover:text-white border border-blue-900/60 text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-cyan-400" /> : <Copy className="w-4 h-4 text-blue-400" />}
                <span>{copied ? 'ID Copiado!' : 'Copiar ID da Sala e Senha'}</span>
              </button>
            </div>

            {isAdmin && (
              <div className="mt-5 pt-4 border-t border-blue-950 space-y-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Controles do Administrador
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-semibold">Mensagem no Topo (Aviso)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="Ex: Sessão começando..."
                      className="flex-1 bg-slate-950 border border-blue-950 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      onClick={() => onAdminAction('set_announcement', undefined, announcementText)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Spectators List */}
          <div className="bg-slate-900/90 border border-blue-900/40 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-950">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Espectadores Conectados ({roomState.spectators.length}/5)
              </h3>
              <span className="text-[10px] text-cyan-400 font-mono">Sincronizados</span>
            </div>

            <div className="space-y-2">
              {roomState.spectators.map((spectator) => {
                const isMe = spectator.id === currentUser?.id;
                return (
                  <div
                    key={spectator.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${
                      isMe
                        ? 'bg-blue-950/50 border-blue-500/40'
                        : 'bg-slate-950 border-blue-950'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{spectator.avatar || '🍿'}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          {spectator.name} {isMe && <span className="text-[10px] text-cyan-400 font-bold">(Você)</span>}
                          {spectator.isAdmin && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 flex items-center gap-0.5">
                              <Crown className="w-2 h-2 fill-current" />
                              ADMIN
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          Poltrona {spectator.seatIndex + 1}
                        </p>
                      </div>
                    </div>

                    {isAdmin && !isMe && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onAdminAction('transfer_admin', spectator.id)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-600/30 text-cyan-300 text-[10px] border border-blue-900"
                          title="Passar cargo de Admin"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onAdminAction('kick', spectator.id)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-600/30 text-red-400 text-[10px] border border-blue-900"
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
