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
import { cinemaAudio } from './services/soundEffects';
import {
  Film,
  Tv,
  LogOut,
  Volume2,
  VolumeX,
  Crown,
  Share2,
  Sparkles,
  MessageSquare,
  Users,
  SlidersHorizontal,
  Hash,
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
    const text = `🎬 Convite CineRoom 4K!\n📍 ID da Sala: ${roomState.roomId || roomState.ipPort}\n🍿 Capacidade: Máx 5 pessoas\nEntre para assistir em Ultra Qualidade!`;
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
  const canControl = isAdmin;

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[9999] max-w-sm animate-fadeIn">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-xl ${
              toastMessage.level === 'warning'
                ? 'bg-amber-950/95 border-amber-500/50 text-amber-200'
                : toastMessage.level === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
                : 'bg-slate-900/95 border-blue-500/50 text-cyan-200 shadow-blue-950/70'
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="truncate">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 border-b border-blue-900/50 backdrop-blur-xl px-3 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Logo & ID da Sala */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-950 font-black text-base sm:text-lg flex-shrink-0 border border-cyan-400/40">
              🎬
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-xs sm:text-base font-black text-white tracking-tight truncate">
                  {roomState.roomName || 'CineRoom 4K'}
                </h1>
                {isAdmin && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 flex items-center gap-0.5">
                    <Crown className="w-2 h-2 fill-current" />
                    ADMIN
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                <span className="text-cyan-400 font-bold truncate flex items-center gap-0.5">
                  <Hash className="w-3 h-3" />
                  ID: {roomState.roomId || roomState.ipPort}
                </span>
                <span>•</span>
                <span className="text-slate-300 whitespace-nowrap">
                  {roomState.spectators.length}/5 VIP
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Share ID */}
            <button
              onClick={handleCopyQuickLink}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-blue-900/60 text-xs font-semibold text-cyan-300 transition-all flex items-center gap-1"
              title="Copiar ID da sala"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{copiedLink ? 'Copiado!' : 'Compartilhar ID'}</span>
            </button>

            {/* Sound FX */}
            <button
              onClick={toggleSoundFx}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-blue-900/60 text-slate-300 hover:text-white"
              title={isAudioMuted ? 'Ativar Sons' : 'Silenciar'}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4 text-cyan-400" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
            </button>

            {/* BOTÃO DE CINEMA */}
            <button
              onClick={() => setIsCinemaModeOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs sm:text-sm shadow-lg shadow-blue-950 transition-all active:scale-95 border border-cyan-400/40"
              title="Preencher tela e ativar Modo Cinema sem recarregar vídeo"
            >
              <Tv className="w-4 h-4" />
              <span className="tracking-wide">MODO CINEMA</span>
            </button>

            {/* Leave */}
            <button
              onClick={leaveRoom}
              className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/60 border border-blue-900/60 text-slate-400 hover:text-red-300"
              title="Sair da Sala"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden sticky top-[57px] z-30 bg-slate-950/95 border-b border-blue-900/50 px-3 py-1.5 backdrop-blur-lg">
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => setMobileTab('player')}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
              mobileTab === 'player'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow'
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
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow'
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
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow'
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
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>VIP ({roomState.spectators.length}/5)</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 mt-4 sm:mt-6 space-y-6 flex-1 w-full">
        {/* Desktop Layout */}
        <div className="hidden lg:grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <CinemaPlayer
              videoState={roomState.videoState}
              isAdmin={isAdmin}
              canControl={canControl}
              floatingReactions={floatingReactions}
              spectators={roomState.spectators}
              messages={roomState.messages}
              isCinemaMode={isCinemaModeOpen}
              onToggleCinemaMode={() => setIsCinemaModeOpen((prev) => !prev)}
              onPlay={playMedia}
              onPause={pauseMedia}
              onSeek={seekMedia}
              onChangeQuality={changeQuality}
              onSendMessage={sendMessage}
              onSendReaction={sendReaction}
            />
            {!isCinemaModeOpen && (
              <SeatVisualizer
                spectators={roomState.spectators}
                currentUserId={currentUser.id}
                maxSeats={roomState.maxUsers || 5}
              />
            )}
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

        {/* Mobile Layout */}
        <div className="lg:hidden space-y-4">
          {mobileTab === 'player' && (
            <div className="space-y-4">
              <CinemaPlayer
                videoState={roomState.videoState}
                isAdmin={isAdmin}
                canControl={canControl}
                floatingReactions={floatingReactions}
                spectators={roomState.spectators}
                messages={roomState.messages}
                isCinemaMode={isCinemaModeOpen}
                onToggleCinemaMode={() => setIsCinemaModeOpen((prev) => !prev)}
                onPlay={playMedia}
                onPause={pauseMedia}
                onSeek={seekMedia}
                onChangeQuality={changeQuality}
                onSendMessage={sendMessage}
                onSendReaction={sendReaction}
              />
              {!isCinemaModeOpen && (
                <SeatVisualizer
                  spectators={roomState.spectators}
                  currentUserId={currentUser.id}
                  maxSeats={roomState.maxUsers || 5}
                />
              )}
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
            </div>
          )}
        </div>

        {/* Desktop Lower Section: Control Panel */}
        {!isCinemaModeOpen && (
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
        )}
      </main>
    </div>
  );
}
