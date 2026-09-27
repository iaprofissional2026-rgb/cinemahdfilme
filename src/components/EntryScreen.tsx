import React, { useState, useEffect } from 'react';
import { Film, Lock, Server, User, Sparkles, PlusCircle, LogIn, Users, ShieldAlert, CheckCircle2, Tv, AlertCircle } from 'lucide-react';

interface EntryScreenProps {
  onJoinRoom: (ipPort: string, password: string, userName?: string, avatar?: string) => void;
  onCreateRoom: (ipPort: string, password: string, roomName?: string, userName?: string, avatar?: string) => void;
  error: string | null;
  isConnecting: boolean;
  onClearError: () => void;
}

export const EntryScreen: React.FC<EntryScreenProps> = ({
  onJoinRoom,
  onCreateRoom,
  error,
  isConnecting,
  onClearError,
}) => {
  const [tab, setTab] = useState<'join' | 'create'>('join');

  // Join Form State
  const [joinIpPort, setJoinIpPort] = useState('192.168.1.100:8080');
  const [joinPassword, setJoinPassword] = useState('123');
  const [joinUserName, setJoinUserName] = useState('');
  const [joinAvatar, setJoinAvatar] = useState('🍿');

  // Create Form State
  const [createIpPort, setCreateIpPort] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRoomName, setCreateRoomName] = useState('');
  const [createUserName, setCreateUserName] = useState('');
  const [createAvatar, setCreateAvatar] = useState('🎬');

  // Room verification check
  const [roomCheckStatus, setRoomCheckStatus] = useState<{
    exists?: boolean;
    spectatorCount?: number;
    maxUsers?: number;
    isFull?: boolean;
    roomName?: string;
  } | null>(null);

  const avatars = ['🍿', '🕶️', '🥤', '🎬', '🎟️', '⭐', '🪐', '🦁', '🚀', '🔥'];

  // Auto-generate unique IP and Port
  const generateRandomIpPort = () => {
    const octet = Math.floor(100 + Math.random() * 150);
    const port = Math.floor(3000 + Math.random() * 6000);
    return `192.168.1.${octet}:${port}`;
  };

  useEffect(() => {
    if (!createIpPort) {
      setCreateIpPort(generateRandomIpPort());
      setCreatePassword(Math.floor(1000 + Math.random() * 9000).toString());
      setCreateRoomName('Minha Sala de Cinema VIP');
    }
  }, []);

  // Check room status dynamically when joinIpPort changes
  useEffect(() => {
    if (!joinIpPort.trim()) {
      setRoomCheckStatus(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/rooms/check?ipPort=${encodeURIComponent(joinIpPort.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setRoomCheckStatus(data);
          return;
        }
      } catch (e) {
        // Fallback for Netlify/static hosting
      }

      // Check localStorage for static fallback
      try {
        const sanitized = joinIpPort.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const local = localStorage.getItem(`cineroom_${sanitized}_state`);
        if (local) {
          const parsed = JSON.parse(local);
          setRoomCheckStatus({
            exists: true,
            roomName: parsed.roomName,
            spectatorCount: parsed.spectators?.length || 1,
            maxUsers: parsed.maxUsers || 5,
            isFull: (parsed.spectators?.length || 1) >= (parsed.maxUsers || 5),
          });
          return;
        }
      } catch (e) {}

      setRoomCheckStatus({ exists: true, roomName: `Sala ${joinIpPort.trim()}`, spectatorCount: 1, maxUsers: 5, isFull: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [joinIpPort]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    onJoinRoom(joinIpPort.trim(), joinPassword.trim(), joinUserName.trim(), joinAvatar);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    onCreateRoom(
      createIpPort.trim(),
      createPassword.trim(),
      createRoomName.trim(),
      createUserName.trim(),
      createAvatar
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 relative overflow-hidden bg-[#07090e]">
      {/* Cinematic Ambient Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-xl">
        {/* Cinema Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold tracking-widest uppercase mb-3 shadow-lg shadow-rose-950/40 animate-pulse">
            <Film className="w-3.5 h-3.5" />
            <span>SALA DE CINEMA PRIVADA • ULTRA 4K</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight font-serif">
            Cine<span className="text-rose-500">Room</span> <span className="text-amber-400 text-2xl sm:text-3xl font-sans font-bold">4K</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            Sessão síncrona exclusiva. Entre com o <strong className="text-slate-200">IP da Porta</strong> e <strong className="text-slate-200">Senha</strong>. Capacidade estrita de <span className="text-rose-400 font-bold">5 pessoas</span>.
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-slate-900/85 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {/* Subtle Top Red Glow Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600" />

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 mb-6">
            <button
              onClick={() => {
                setTab('join');
                onClearError();
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                tab === 'join'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar na Sala</span>
            </button>
            <button
              onClick={() => {
                setTab('create');
                onClearError();
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                tab === 'create'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Criar Nova Sala</span>
            </button>
          </div>

          {/* Error Message Box */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-950/50 border border-rose-500/50 rounded-2xl flex items-start gap-3 text-rose-200 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Atenção ao Acessar:</p>
                <p className="text-[11px] text-rose-300/90">{error}</p>
              </div>
            </div>
          )}

          {/* JOIN TAB */}
          {tab === 'join' && (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              {/* IP da Porta */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  IP da Porta (Código da Sala)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={joinIpPort}
                    onChange={(e) => setJoinIpPort(e.target.value)}
                    placeholder="Ex: 192.168.1.100:8080"
                    required
                    className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 font-mono transition-all"
                  />
                </div>
              </div>

              {/* Room Live Status Indicator */}
              {roomCheckStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    roomCheckStatus.exists
                      ? roomCheckStatus.isFull
                        ? 'bg-red-950/30 border-red-500/40 text-red-300'
                        : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        roomCheckStatus.exists
                          ? roomCheckStatus.isFull
                            ? 'bg-red-500'
                            : 'bg-emerald-400 animate-ping'
                          : 'bg-slate-600'
                      }`}
                    />
                    <span>
                      {roomCheckStatus.exists
                        ? `Sala: ${roomCheckStatus.roomName || 'Cinema VIP'}`
                        : 'Sala nova ou offline (será criada se for o primeiro)'}
                    </span>
                  </div>
                  {roomCheckStatus.exists && (
                    <span className="font-mono font-bold">
                      {roomCheckStatus.spectatorCount}/{roomCheckStatus.maxUsers || 5} Poltronas
                      {roomCheckStatus.isFull && ' (CHEIA)'}
                    </span>
                  )}
                </div>
              )}

              {/* Senha da Porta */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Senha da Porta
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Digite a senha de acesso"
                    required
                    className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 font-mono transition-all"
                  />
                </div>
              </div>

              {/* Nome do Espectador */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Seu Nome / Apelido
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={joinUserName}
                    onChange={(e) => setJoinUserName(e.target.value)}
                    placeholder="Ex: Carlos Cinema"
                    className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Escolha seu Avatar da Poltrona
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {avatars.map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setJoinAvatar(av)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                        joinAvatar === av
                          ? 'bg-rose-600 ring-2 ring-rose-400 scale-110 shadow-lg shadow-rose-950'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isConnecting}
                className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm tracking-wide shadow-xl shadow-rose-950/70 transition-all transform active:scale-98 flex items-center justify-center gap-2"
              >
                <Tv className="w-4 h-4" />
                <span>{isConnecting ? 'Conectando à Porta...' : 'ENTRAR NA SALA DE CINEMA'}</span>
              </button>
            </form>
          )}

          {/* CREATE TAB */}
          {tab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* IP da Porta Generator */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    IP da Porta
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreateIpPort(generateRandomIpPort())}
                    className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                  >
                    Gerar Novo IP:Porta
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={createIpPort}
                    onChange={(e) => setCreateIpPort(e.target.value)}
                    placeholder="Ex: 192.168.1.108:8080"
                    required
                    className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

              {/* Senha da Porta */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Defina a Senha da Porta
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Defina uma senha"
                    required
                    className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

              {/* Nome da Sala */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nome da Sessão de Cinema
                </label>
                <input
                  type="text"
                  value={createRoomName}
                  onChange={(e) => setCreateRoomName(e.target.value)}
                  placeholder="Ex: Noite de Filmes 4K"
                  className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition-all"
                />
              </div>

              {/* Seu Nome (Host) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Seu Nome (Administrador da Sala)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-rose-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={createUserName}
                    onChange={(e) => setCreateUserName(e.target.value)}
                    placeholder="Ex: Host Cineasta"
                    className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

              {/* 5-User Fixed Capacity Notice */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold text-slate-200">Capacidade Máxima da Sala:</span>
                </div>
                <span className="text-xs font-mono font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  5 Poltronas VIP
                </span>
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Seu Ícone de Host
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {avatars.map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setCreateAvatar(av)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                        createAvatar === av
                          ? 'bg-rose-600 ring-2 ring-rose-400 scale-110 shadow-lg shadow-rose-950'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isConnecting}
                className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm tracking-wide shadow-xl shadow-rose-950/70 transition-all transform active:scale-98 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>CRIAR SALA E ABRIR PAINEL DE CONTROLE</span>
              </button>
            </form>
          )}

          {/* Quick Demo Access Bar */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 mb-2">
              Quer testar rapidamente com filme 4K carregado?
            </p>
            <button
              onClick={() => onJoinRoom('192.168.1.100:8080', '123', 'Espectador VIP', '🍿')}
              className="text-xs font-mono font-bold text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/50 transition-all"
            >
              Entrar na Sala Demo (192.168.1.100:8080 • Senha: 123)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
