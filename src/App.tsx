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
  Lock,
  Share2,
  Sparkles,
  Info,
  Radio,
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

  const toggleSoundFx = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    cinemaAudio.setMuted(nextMuted);
  };

  const handleCopyQuickLink = () => {
    if (!roomState) return;
    const text = `🎬 Sala de Cinema CineRoom 4K!\nIP da Porta: ${roomState.ipPort}\nSenha: (solicite ao host)\n🍿 Capacidade: Máx 5 pessoas`;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // If user is not inside a room, show Entry Screen
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
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-rose-600 selection:text-white pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] animate-fadeIn">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-xl ${
              toastMessage.level === 'warning'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                : toastMessage.level === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-slate-900/90 border-rose-500/40 text-slate-100 shadow-rose-950/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 border-b border-slate-800 backdrop-blur-xl px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Room IP */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-950 font-black text-lg">
              🎬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  {roomState.roomName || 'CineRoom 4K'}
                </h1>
                {isAdmin && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-black flex items-center gap-0.5">
                    <Crown className="w-2.5 h-2.5 fill-current" />
                    HOST
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="text-rose-400 font-bold">IP: {roomState.ipPort}</span>
                <span>•</span>
                <span className="text-slate-300">
                  {roomState.spectators.length}/5 Poltronas
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Share / Copy button */}
            <button
              onClick={handleCopyQuickLink}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-all"
              title="Copiar dados da sala"
            >
              <Share2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{copiedLink ? 'Copiado!' : 'Compartilhar IP'}</span>
            </button>

            {/* Sound Effects Toggle */}
            <button
              onClick={toggleSoundFx}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all"
              title={isAudioMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar Efeitos'}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Ping Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>{pingMs}ms</span>
            </div>

            {/* "BOTÃO DE CINEMA" (Modo Cinema Paisagem) */}
            <button
              onClick={() => setIsCinemaModeOpen(true)}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-rose-950 transition-all transform hover:scale-105 active:scale-95 border border-rose-400/30"
              title="Preencher tela e ativar Modo Cinema no celular ou notebook"
            >
              <Tv className="w-4 h-4" />
              <span>MODO CINEMA</span>
            </button>

            {/* Leave Room Button */}
            <button
              onClick={leaveRoom}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-xs font-semibold transition-all flex items-center gap-1.5"
              title="Sair da Sala"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 space-y-6 flex-1 w-full">
        {/* Top: Cinema Player & Live Chat Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2 Cols: Player */}
          <div className="lg:col-span-2 space-y-4">
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

            {/* VIP 5-Seat Visualizer */}
            <SeatVisualizer
              spectators={roomState.spectators}
              currentUserId={currentUser.id}
              maxSeats={roomState.maxUsers || 5}
            />
          </div>

          {/* Right 1 Col: Live Cinema Chat */}
          <div className="space-y-4">
            <CinemaChat
              messages={roomState.messages}
              currentUser={currentUser}
              onSendMessage={sendMessage}
              onSendReaction={sendReaction}
            />
          </div>
        </div>

        {/* Lower Section: Painel de Controle (Admin & Spectators) */}
        <div className="pt-2">
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
