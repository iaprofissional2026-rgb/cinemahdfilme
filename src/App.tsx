/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCinemaSocket } from './hooks/useCinemaSocket';
import { EntryScreen } from './components/EntryScreen';
import { CinemaPlayer } from './components/CinemaPlayer';
import { SeatVisualizer } from './components/SeatVisualizer';
import { ControlPanel } from './components/ControlPanel';
import { CinemaChat } from './components/CinemaChat';
import { CinemaModeOverlay } from './components/CinemaModeOverlay';
import { cinemaAudio } from './services/soundEffects';
import {
  Film,
  Tv,
  LogOut,
  Volume2,
  VolumeX,
  Wifi,
  Crown,
  Share2,
  Sparkles,
  MessageSquare,
  Users,
  SlidersHorizontal,
} from 'lucide-react';

export default function App() {
  const {
    isConnected,
    isConnecting,
    currentUser,
    roomState,
    error,
    toastMessage,
    floatingReactions,
    pingMs,
    joinRoom,
    createRoom,
    playMedia,
    pauseMedia,
    seekMedia,
    changeMedia,
    changeQuality,
    sendMessage,
    sendReaction,
    adminAction,
    leaveRoom,
    clearError,
  } = useCinemaSocket();

  const [isCinemaModeOpen, setIsCinemaModeOpen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [mobileTab, setMobileTab] = useState<'player' | 'panel' | 'chat' | 'seats'>('player');

  const toggleSoundFx = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    cinemaAudio.setMuted(nextMuted);
  };

  const handleCopyQuickLink = () => {
    if (!roomState) return;
    const text = `🎬 Sala de Cinema CineRoom 4K!\n📍 IP da Porta: ${roomState.ipPort}\n🍿 Capacidade: Máx 5 pessoas\nEntre agora para assistir em Ultra Qualidade!`;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (!roomState || !currentUser) {
    return (
      <EntryScreen
        onJoinRoom={joinRoom}
        onCreateRoom={createRoom}
        error={error}
        isConnecting={isConnecting}
        onClearError={clearError}
      />
    );
  }

  const isAdmin = currentUser.isAdmin;
  const canControl = !roomState.adminOnlyControl || isAdmin;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-rose-600 selection:text-white pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[9999] max-w-sm animate-fadeIn">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-xl ${
              toastMessage.level === 'warning'
                ? 'bg-amber-950/95 border-amber-500/50 text-amber-200'
                : toastMessage.level === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
                : 'bg-slate-900/95 border-rose-500/40 text-slate-100 shadow-rose-950/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="truncate">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 border-b border-slate-800/90 backdrop-blur-xl px-3 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Logo & IP */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-950 font-black text-base sm:text-lg flex-shrink-0">
              🎬
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-xs sm:text-base font-black text-white tracking-tight truncate">
                  {roomState.roomName || 'CineRoom 4K'}
                </h1>
                {isAdmin && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-500 text-black flex items-center gap-0.5">
                    <Crown className="w-2 h-2 fill-current" />
                    HOST
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                <span className="text-rose-400 font-bold truncate">IP: {roomState.ipPort}</span>
                <span>•</span>
                <span className="text-slate-300 whitespace-nowrap">
                  {roomState.spectators.length}/5 VIP
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Share IP */}
            <button
              onClick={handleCopyQuickLink}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center gap-1"
              title="Copiar dados da sala"
            >
              <Share2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">{copiedLink ? 'Copiado!' : 'Compartilhar'}</span>
            </button>

            {/* Sound FX */}
            <button
              onClick={toggleSoundFx}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white"
              title={isAudioMuted ? 'Ativar Sons' : 'Silenciar'}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* BOTÃO DE CINEMA */}
            <button
              onClick={() => setIsCinemaModeOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-rose-950 transition-all active:scale-95 border border-rose-400/40"
              title="Preencher tela e ativar Modo Cinema no celular ou notebook"
            >
              <Tv className="w-4 h-4" />
              <span className="tracking-wide">MODO CINEMA</span>
            </button>

            {/* Leave */}
            <button
              onClick={leaveRoom}
              className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 text-slate-400 hover:text-rose-300"
              title="Sair da Sala"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Navigation (< lg screens) */}
      <div className="lg:hidden sticky top-[57px] z-30 bg-slate-950/95 border-b border-slate-800 px-3 py-1.5 backdrop-blur-lg">
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => setMobileTab('player')}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
              mobileTab === 'player'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Vídeo</span>
          </button>
          <button
            onClick={() => setMobileTab('panel')}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
              mobileTab === 'panel'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Painel</span>
          </button>
          <button
            onClick={() => setMobileTab('chat')}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 relative ${
              mobileTab === 'chat'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => setMobileTab('seats')}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
              mobileTab === 'seats'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Poltronas ({roomState.spectators.length}/5)</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 mt-4 sm:mt-6 space-y-6 flex-1 w-full">
        {/* Desktop Layout (>= lg) */}
        <div className="hidden lg:grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <CinemaPlayer
              videoState={roomState.videoState}
              isAdmin={isAdmin}
              canControl={canControl}
              floatingReactions={floatingReactions}
              spectators={roomState.spectators}
              onPlay={playMedia}
              onPause={pauseMedia}
              onSeek={seekMedia}
              onOpenCinemaMode={() => setIsCinemaModeOpen(true)}
              onChangeQuality={changeQuality}
            />
            <SeatVisualizer
              spectators={roomState.spectators}
              currentUserId={currentUser.id}
              maxSeats={roomState.maxUsers || 5}
            />
          </div>

          <div className="space-y-4">
            <CinemaChat
              messages={roomState.messages}
              currentUser={currentUser}
              onSendMessage={sendMessage}
              onSendReaction={sendReaction}
            />
          </div>
        </div>

        {/* Mobile Layout (< lg) Based on Selected Tab */}
        <div className="lg:hidden space-y-4">
          {mobileTab === 'player' && (
            <div className="space-y-4">
              <CinemaPlayer
                videoState={roomState.videoState}
                isAdmin={isAdmin}
                canControl={canControl}
                floatingReactions={floatingReactions}
                spectators={roomState.spectators}
                onPlay={playMedia}
                onPause={pauseMedia}
                onSeek={seekMedia}
                onOpenCinemaMode={() => setIsCinemaModeOpen(true)}
                onChangeQuality={changeQuality}
              />
              <SeatVisualizer
                spectators={roomState.spectators}
                currentUserId={currentUser.id}
                maxSeats={roomState.maxUsers || 5}
              />
            </div>
          )}

          {mobileTab === 'panel' && (
            <ControlPanel
              roomState={roomState}
              currentUser={currentUser}
              isAdmin={isAdmin}
              canControl={canControl}
              onChangeMedia={changeMedia}
              onPlay={playMedia}
              onPause={pauseMedia}
              onSeek={seekMedia}
              onChangeQuality={changeQuality}
              onAdminAction={adminAction}
              onOpenCinemaMode={() => setIsCinemaModeOpen(true)}
            />
          )}

          {mobileTab === 'chat' && (
            <CinemaChat
              messages={roomState.messages}
              currentUser={currentUser}
              onSendMessage={sendMessage}
              onSendReaction={sendReaction}
            />
          )}

          {mobileTab === 'seats' && (
            <div className="space-y-4">
              <SeatVisualizer
                spectators={roomState.spectators}
                currentUserId={currentUser.id}
                maxSeats={roomState.maxUsers || 5}
              />
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Espectadores Conectados ({roomState.spectators.length}/5)
                </h3>
                <div className="space-y-2">
                  {roomState.spectators.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{s.avatar}</span>
                        <div>
                          <p className="text-xs font-bold text-white">{s.name} {s.id === currentUser.id && '(Você)'}</p>
                          <p className="text-[10px] text-slate-400 font-mono">Poltrona {s.seatIndex + 1} {s.isAdmin && '• Host'}</p>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Lower Section: Control Panel */}
        <div className="hidden lg:block pt-2">
          <ControlPanel
            roomState={roomState}
            currentUser={currentUser}
            isAdmin={isAdmin}
            canControl={canControl}
            onChangeMedia={changeMedia}
            onPlay={playMedia}
            onPause={pauseMedia}
            onSeek={seekMedia}
            onChangeQuality={changeQuality}
            onAdminAction={adminAction}
            onOpenCinemaMode={() => setIsCinemaModeOpen(true)}
          />
        </div>
      </main>

      {/* Fullscreen Landscape Cinema Mode Overlay */}
      <CinemaModeOverlay
        isOpen={isCinemaModeOpen}
        onClose={() => setIsCinemaModeOpen(false)}
        videoState={roomState.videoState}
        isAdmin={isAdmin}
        canControl={canControl}
        spectators={roomState.spectators}
        messages={roomState.messages}
        floatingReactions={floatingReactions}
        onPlay={playMedia}
        onPause={pauseMedia}
        onSeek={seekMedia}
        onSendMessage={sendMessage}
        onSendReaction={sendReaction}
        onChangeQuality={changeQuality}
      />
    </div>
  );
}
