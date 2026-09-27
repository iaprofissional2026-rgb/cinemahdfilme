import React, { useState, useEffect } from 'react';
import { Film, Lock, Sparkles, PlusCircle, LogIn, Users, AlertCircle, Tv, Hash, User } from 'lucide-react';

interface EntryScreenProps {
  onJoinRoom: (roomId: string, password?: string, userName?: string, avatar?: string) => void;
  onCreateRoom: (roomId: string, password?: string, roomName?: string, userName?: string, avatar?: string) => void;
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
  const [joinRoomId, setJoinRoomId] = useState('SALA-774');
  const [joinPassword, setJoinPassword] = useState('123');
  const [joinUserName, setJoinUserName] = useState('');
  const [joinAvatar, setJoinAvatar] = useState('🍿');

  // Create Form State
  const [createRoomId, setCreateRoomId] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRoomName, setCreateRoomName] = useState('');
  const [createUserName, setCreateUserName] = useState('');
  const [createAvatar, setCreateAvatar] = useState('🎬');

  const avatars = ['🍿', '🕶️', '🥤', '🎬', '🎟️', '⭐', '🪐', '🦁', '🚀', '🔥'];

  // Auto-generate clean Room ID
  const generateRandomRoomId = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `SALA-${num}`;
  };

  useEffect(() => {
    if (!createRoomId) {
      setCreateRoomId(generateRandomRoomId());
      setCreatePassword('123');
      setCreateRoomName('Minha Sessão VIP 4K');
    }
  }, []);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    onJoinRoom(joinRoomId.trim().toUpperCase(), joinPassword.trim(), joinUserName.trim(), joinAvatar);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    onCreateRoom(
      createRoomId.trim().toUpperCase(),
      createPassword.trim(),
      createRoomName.trim(),
      createUserName.trim(),
      createAvatar
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 relative overflow-hidden bg-[#050814]">
      {/* Ambient Blue Gradient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/15 to-cyan-500/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-blue-700/15 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-xl">
        {/* Cinema Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-cyan-300 text-xs font-bold tracking-widest uppercase mb-3 shadow-lg shadow-blue-950/60 animate-pulse">
            <Film className="w-3.5 h-3.5 text-cyan-400" />
            <span>SALA DE CINEMA PRIVADA • AZUL ULTRA 4K</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight font-serif">
            Cine<span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">Room</span> <span className="text-cyan-400 text-2xl sm:text-3xl font-sans font-bold">4K</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            Entre com o <strong className="text-cyan-300">ID da Sala</strong>. O <strong className="text-cyan-300">Admin tem controle total</strong> de pausar e despausar o filme para até <span className="text-cyan-400 font-bold">5 pessoas</span>.
          </p>
        </div>

        {/* Form Card Box */}
        <div className="bg-slate-900/90 border border-blue-900/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400" />

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/90 rounded-2xl border border-blue-950 mb-6">
            <button
              onClick={() => {
                setTab('join');
                onClearError();
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                tab === 'join'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4 text-cyan-300" />
              <span>Entrar na Sala</span>
            </button>
            <button
              onClick={() => {
                setTab('create');
                onClearError();
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                tab === 'create'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-cyan-300" />
              <span>Criar Nova Sala</span>
            </button>
          </div>

          {/* Error Message Box */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-950/50 border border-red-500/50 rounded-2xl flex items-start gap-3 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Aviso:</p>
                <p className="text-[11px] text-red-300/90">{error}</p>
              </div>
            </div>
          )}

          {/* JOIN TAB */}
          {tab === 'join' && (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  ID da Sala (Código de Acesso)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cyan-400 font-bold">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Ex: SALA-774 ou CINE-VIP"
                    required
                    className="w-full bg-slate-950/90 border border-blue-900/60 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 font-mono uppercase tracking-wider transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Senha da Sala (se houver)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cyan-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Digite a senha (padrão: 123)"
                    className="w-full bg-slate-950/90 border border-blue-900/60 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 font-mono transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Seu Nome / Apelido
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cyan-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={joinUserName}
                    onChange={(e) => setJoinUserName(e.target.value)}
                    placeholder="Ex: Pedro Cinema"
                    className="w-full bg-slate-950/90 border border-blue-900/60 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

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
                          ? 'bg-gradient-to-br from-blue-600 to-cyan-500 ring-2 ring-cyan-300 scale-110 shadow-lg shadow-blue-950'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isConnecting}
                className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-sm tracking-wide shadow-xl shadow-blue-950/80 transition-all transform active:scale-98 flex items-center justify-center gap-2 border border-cyan-400/30"
              >
                <Tv className="w-4 h-4" />
                <span>{isConnecting ? 'Conectando...' : 'ENTRAR NA SALA COM ID'}</span>
              </button>
            </form>
          )}

          {/* CREATE TAB */}
          {tab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    ID da Sala
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreateRoomId(generateRandomRoomId())}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold"
                  >
                    Gerar Novo ID
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cyan-400 font-bold">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={createRoomId}
                    onChange={(e) => setCreateRoomId(e.target.value)}
                    placeholder="Ex: SALA-774"
                    required
                    className="w-full bg-slate-950/90 border border-blue-900/60 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono uppercase tracking-wider placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Defina a Senha da Sala
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cyan-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Defina uma senha (ex: 123)"
                    className="w-full bg-slate-950/90 border border-blue-900/60 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nome da Sessão
                </label>
                <input
                  type="text"
                  value={createRoomName}
                  onChange={(e) => setCreateRoomName(e.target.value)}
                  placeholder="Ex: Sala VIP Cinema 4K"
                  className="w-full bg-slate-950/90 border border-blue-900/60 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Seu Nome (Host / Administrador)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cyan-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={createUserName}
                    onChange={(e) => setCreateUserName(e.target.value)}
                    placeholder="Ex: Admin Cineasta"
                    className="w-full bg-slate-950/90 border border-blue-900/60 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

              <div className="bg-slate-950/80 border border-blue-900/50 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200">Capacidade Máxima:</span>
                </div>
                <span className="text-xs font-mono font-black text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/20">
                  5 Poltronas VIP
                </span>
              </div>

              <button
                type="submit"
                disabled={isConnecting}
                className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-sm tracking-wide shadow-xl shadow-blue-950/80 transition-all transform active:scale-98 flex items-center justify-center gap-2 border border-cyan-400/30"
              >
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <span>CRIAR SALA E ASSUMIR CONTROLE ADMIN</span>
              </button>
            </form>
          )}

          {/* Quick Demo */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-400 mb-2">
              Teste rápido com ID pronto:
            </p>
            <button
              onClick={() => onJoinRoom('SALA-774', '123', 'Espectador VIP', '🍿')}
              className="text-xs font-mono font-bold text-cyan-400 hover:text-cyan-300 px-3.5 py-1.5 rounded-xl bg-slate-950 border border-blue-900/50 hover:border-cyan-400/50 transition-all"
            >
              Entrar na Sala Demo (ID: SALA-774 • Senha: 123)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
