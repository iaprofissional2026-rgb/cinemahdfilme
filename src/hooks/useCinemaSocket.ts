import { useState, useEffect, useRef, useCallback } from 'react';
import { CinemaRoomState, Spectator, ChatMessage, FloatingReaction, QualityPreset, VideoState } from '../types/cinema';
import { cinemaAudio } from '../services/soundEffects';
import { universalSync, SyncPacket } from '../services/universalSyncEngine';

interface UseCinemaSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  currentUser: Spectator | null;
  roomState: CinemaRoomState | null;
  error: string | null;
  toastMessage: { text: string; level: 'info' | 'warning' | 'success' } | null;
  floatingReactions: FloatingReaction[];
  pingMs: number;
  joinRoom: (ipPort: string, password: string, userName?: string, avatar?: string) => void;
  createRoom: (ipPort: string, password: string, roomName?: string, userName?: string, avatar?: string) => void;
  playMedia: (currentTime?: number) => void;
  pauseMedia: (currentTime?: number) => void;
  seekMedia: (time: number) => void;
  changeMedia: (url: string, title?: string, duration?: number) => void;
  changeQuality: (preset: QualityPreset) => void;
  sendMessage: (text: string) => void;
  sendReaction: (emoji: string) => void;
  adminAction: (action: 'kick' | 'transfer_admin' | 'set_announcement' | 'toggle_admin_control', targetUserId?: string, value?: any) => void;
  leaveRoom: () => void;
  clearError: () => void;
}

export function useCinemaSocket(): UseCinemaSocketReturn {
  const [isConnected, setIsConnected] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentUser, setCurrentUser] = useState<Spectator | null>(null);
  const [roomState, setRoomState] = useState<CinemaRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; level: 'info' | 'warning' | 'success' } | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [pingMs, setPingMs] = useState(15);

  const peerHeartbeatsRef = useRef<Map<string, number>>(new Map());
  const cleanupTimerRef = useRef<any>(null);
  const hostPulseTimerRef = useRef<any>(null);
  const currentRoomStateRef = useRef<CinemaRoomState | null>(null);
  const currentUserRef = useRef<Spectator | null>(null);

  useEffect(() => {
    currentRoomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const showToast = useCallback((text: string, level: 'info' | 'warning' | 'success' = 'info') => {
    setToastMessage({ text, level });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  // Periodic Host Pulse broadcasting current video & playback to ensure guests never miss anything
  useEffect(() => {
    if (currentUser?.isAdmin) {
      if (hostPulseTimerRef.current) clearInterval(hostPulseTimerRef.current);
      hostPulseTimerRef.current = setInterval(() => {
        if (currentRoomStateRef.current) {
          universalSync.publish('SYNC_PULSE', {
            videoState: currentRoomStateRef.current.videoState,
            announcement: currentRoomStateRef.current.announcement,
            adminOnlyControl: currentRoomStateRef.current.adminOnlyControl,
            roomName: currentRoomStateRef.current.roomName,
          });
        }
      }, 2500);
    } else {
      if (hostPulseTimerRef.current) clearInterval(hostPulseTimerRef.current);
    }

    return () => {
      if (hostPulseTimerRef.current) clearInterval(hostPulseTimerRef.current);
    };
  }, [currentUser?.isAdmin]);

  // Handle incoming packets
  const handleSyncPacket = useCallback((packet: SyncPacket) => {
    const { type, payload, senderId, senderName, timestamp } = packet;

    switch (type) {
      case 'USER_PRESENCE': {
        const user: Spectator = payload.user;
        if (!user) return;

        peerHeartbeatsRef.current.set(user.id, Date.now());

        setRoomState((prev) => {
          if (!prev) return null;

          const exists = prev.spectators.some((s) => s.id === user.id);
          let updatedSpectators = prev.spectators;

          if (!exists) {
            if (prev.spectators.length >= prev.maxUsers) {
              if (user.id === currentUserRef.current?.id) {
                setError(`Sala Cheia! Limite máximo de ${prev.maxUsers} pessoas atingido.`);
              }
              return prev;
            }

            const takenSeats = new Set(prev.spectators.map((s) => s.seatIndex));
            let seat = user.seatIndex;
            if (takenSeats.has(seat)) {
              for (let i = 0; i < prev.maxUsers; i++) {
                if (!takenSeats.has(i)) {
                  seat = i;
                  break;
                }
              }
            }
            const newUser = { ...user, seatIndex: seat };
            updatedSpectators = [...prev.spectators, newUser];

            if (user.id !== currentUserRef.current?.id && !payload.isHeartbeat) {
              cinemaAudio.playNotification();
              showToast(`${user.name} entrou na sala! (Poltrona ${seat + 1})`, 'info');
            }
          } else {
            updatedSpectators = prev.spectators.map((s) =>
              s.id === user.id ? { ...s, ping: payload.ping || s.ping } : s
            );
          }

          // If Host receives presence from new joiner, send current state snapshot
          if (currentUserRef.current?.isAdmin && user.id !== currentUserRef.current.id && !payload.isHeartbeat) {
            universalSync.publish('STATE_SNAPSHOT', {
              targetUserId: user.id,
              roomState: {
                ...prev,
                spectators: updatedSpectators,
              },
            });
          }

          return {
            ...prev,
            spectators: updatedSpectators,
          };
        });
        break;
      }

      case 'REQUEST_INITIAL_STATE': {
        if (currentUserRef.current?.isAdmin && currentRoomStateRef.current) {
          universalSync.publish('STATE_SNAPSHOT', {
            targetUserId: payload.requesterId,
            roomState: currentRoomStateRef.current,
          });
        }
        break;
      }

      case 'STATE_SNAPSHOT': {
        if (payload.targetUserId === currentUserRef.current?.id && payload.roomState) {
          const snapshot: CinemaRoomState = payload.roomState;
          setRoomState((prev) => {
            if (!prev) return snapshot;
            return {
              ...snapshot,
              spectators: snapshot.spectators.some((s) => s.id === currentUserRef.current?.id)
                ? snapshot.spectators
                : [...snapshot.spectators, currentUserRef.current!],
            };
          });
        }
        break;
      }

      case 'SYNC_PULSE': {
        // Periodic sync pulse from host
        if (!currentUserRef.current?.isAdmin && payload.videoState) {
          setRoomState((prev) => {
            if (!prev) return null;
            // If movie URL is different, update immediately!
            const urlChanged = prev.videoState.url !== payload.videoState.url;
            return {
              ...prev,
              videoState: {
                ...prev.videoState,
                url: payload.videoState.url,
                title: payload.videoState.title,
                isPlaying: payload.videoState.isPlaying,
                currentTime: payload.videoState.currentTime,
                updatedAt: payload.videoState.updatedAt || Date.now(),
                duration: payload.videoState.duration,
                format: payload.videoState.format,
              },
              announcement: payload.announcement ?? prev.announcement,
              adminOnlyControl: payload.adminOnlyControl ?? prev.adminOnlyControl,
            };
          });
        }
        break;
      }

      case 'MEDIA_PLAYED': {
        cinemaAudio.playClick();
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            videoState: {
              ...prev.videoState,
              isPlaying: true,
              currentTime: payload.currentTime,
              updatedAt: payload.updatedAt || timestamp,
            },
          };
        });
        break;
      }

      case 'MEDIA_PAUSED': {
        cinemaAudio.playClick();
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            videoState: {
              ...prev.videoState,
              isPlaying: false,
              currentTime: payload.currentTime,
              updatedAt: payload.updatedAt || timestamp,
            },
          };
        });
        break;
      }

      case 'MEDIA_SEEKED': {
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            videoState: {
              ...prev.videoState,
              currentTime: payload.currentTime,
              updatedAt: payload.updatedAt || timestamp,
              isPlaying: payload.isPlaying ?? prev.videoState.isPlaying,
            },
          };
        });
        break;
      }

      case 'MEDIA_CHANGED': {
        cinemaAudio.playCinemaChime();
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            videoState: payload.videoState,
            messages: payload.message ? [...prev.messages, payload.message] : prev.messages,
          };
        });
        showToast(`Novo filme carregado: ${payload.videoState.title}`, 'info');
        break;
      }

      case 'QUALITY_CHANGED': {
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            videoState: {
              ...prev.videoState,
              qualityPreset: payload.qualityPreset,
            },
          };
        });
        showToast(`Modo Ultra 4K: ${payload.qualityPreset.toUpperCase()}`, 'info');
        break;
      }

      case 'NEW_MESSAGE': {
        cinemaAudio.playNotification();
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [...prev.messages, payload.message],
          };
        });
        break;
      }

      case 'REACTION_EMITTED': {
        if (payload.emoji === '🍿') cinemaAudio.playPopcorn();
        else if (payload.emoji === '👏') cinemaAudio.playApplause();
        else cinemaAudio.playPopcorn();

        const reaction: FloatingReaction = {
          id: `rx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          emoji: payload.emoji,
          userName: senderName,
          userId: senderId,
          seatIndex: payload.seatIndex ?? 0,
          x: 10 + Math.random() * 80,
          timestamp: Date.now(),
        };

        setFloatingReactions((prev) => [...prev.slice(-15), reaction]);
        setTimeout(() => {
          setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
        }, 3200);
        break;
      }

      case 'USER_LEFT': {
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            spectators: prev.spectators.filter((s) => s.id !== payload.userId),
          };
        });
        showToast(`${payload.userName} liberou a poltrona.`, 'info');
        break;
      }

      case 'ADMIN_ACTION': {
        const { action, targetUserId, value } = payload;
        if (action === 'set_announcement') {
          setRoomState((prev) => (prev ? { ...prev, announcement: value } : null));
        } else if (action === 'toggle_admin_control') {
          setRoomState((prev) => (prev ? { ...prev, adminOnlyControl: value } : null));
          showToast(
            value ? 'Controle exclusivo do Host ativado' : 'Controles liberados para todos os espectadores',
            'info'
          );
        } else if (action === 'transfer_admin' && targetUserId) {
          setRoomState((prev) => {
            if (!prev) return null;
            const target = prev.spectators.find((s) => s.id === targetUserId);
            return {
              ...prev,
              adminId: targetUserId,
              adminName: target?.name || 'Host',
              spectators: prev.spectators.map((s) => ({
                ...s,
                isAdmin: s.id === targetUserId,
              })),
            };
          });
          if (targetUserId === currentUserRef.current?.id) {
            setCurrentUser((prev) => (prev ? { ...prev, isAdmin: true } : null));
            showToast('Você agora é o Administrador da Sala!', 'success');
          }
        } else if (action === 'kick' && targetUserId) {
          if (targetUserId === currentUserRef.current?.id) {
            setError('Você foi removido da sala pelo administrador.');
            setRoomState(null);
            setCurrentUser(null);
            universalSync.disconnect();
          } else {
            setRoomState((prev) => (prev ? { ...prev, spectators: prev.spectators.filter((s) => s.id !== targetUserId) } : null));
          }
        }
        break;
      }

      default:
        break;
    }
  }, [showToast]);

  useEffect(() => {
    universalSync.setPacketHandler(handleSyncPacket);
  }, [handleSyncPacket]);

  // Periodic heartbeat cleanup for disconnected peers (> 9s)
  useEffect(() => {
    cleanupTimerRef.current = setInterval(() => {
      const now = Date.now();
      setRoomState((prev) => {
        if (!prev) return null;
        const active = prev.spectators.filter((s) => {
          if (s.id === currentUserRef.current?.id) return true;
          const last = peerHeartbeatsRef.current.get(s.id);
          return last && now - last < 9000;
        });

        if (active.length !== prev.spectators.length) {
          return { ...prev, spectators: active };
        }
        return prev;
      });
    }, 4000);

    return () => {
      if (cleanupTimerRef.current) clearInterval(cleanupTimerRef.current);
    };
  }, []);

  const createRoom = useCallback(
    (ipPort: string, password: string, roomName?: string, userName?: string, avatar?: string) => {
      setError(null);
      setIsConnecting(true);

      const hostUser: Spectator = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: userName?.trim() || 'Host Cineasta',
        avatar: avatar || '🎬',
        seatIndex: 0,
        isAdmin: true,
        isMuted: false,
        ping: 15,
        joinedAt: Date.now(),
      };

      const initialRoom: CinemaRoomState = {
        ipPort,
        roomName: roomName?.trim() || `Sala Cinema ${ipPort}`,
        maxUsers: 5,
        adminId: hostUser.id,
        adminName: hostUser.name,
        videoState: {
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          title: 'Big Buck Bunny (Ultra HD 4K Remaster)',
          isPlaying: false,
          currentTime: 0,
          updatedAt: Date.now(),
          playbackRate: 1.0,
          duration: 596,
          qualityPreset: 'ultra_4k',
          format: 'html5',
        },
        spectators: [hostUser],
        messages: [
          {
            id: `msg-${Date.now()}`,
            userId: 'system',
            userName: 'Cinema',
            avatar: '🎬',
            text: `Sala de Cinema criada por ${hostUser.name}! (1/5 Poltronas ocupadas)`,
            timestamp: Date.now(),
            isSystem: true,
          },
        ],
        announcement: '🍿 Bem-vindos à sessão de Cinema Ultra 4K!',
        isLocked: false,
        adminOnlyControl: true,
      };

      setCurrentUser(hostUser);
      setRoomState(initialRoom);

      try {
        const sanitized = universalSync.sanitizeRoomId(ipPort);
        localStorage.setItem(`cineroom_${sanitized}_pwd`, password);
      } catch (e) {}

      universalSync.connect(ipPort, hostUser, () => {
        setIsConnecting(false);
        setIsConnected(true);
        cinemaAudio.playCinemaChime();
        showToast('Sala de Cinema criada com sucesso! 🎬', 'success');
      });
    },
    [showToast]
  );

  const joinRoom = useCallback(
    (ipPort: string, password: string, userName?: string, avatar?: string) => {
      setError(null);
      setIsConnecting(true);

      const sanitized = universalSync.sanitizeRoomId(ipPort);
      const savedPwd = localStorage.getItem(`cineroom_${sanitized}_pwd`);
      if (savedPwd && savedPwd !== password) {
        setIsConnecting(false);
        setError('Senha da porta incorreta! Verifique os dados digitados.');
        showToast('Senha da porta incorreta!', 'warning');
        return;
      }

      const guestUser: Spectator = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: userName?.trim() || `Espectador #${Math.floor(1 + Math.random() * 4)}`,
        avatar: avatar || '🍿',
        seatIndex: 1,
        isAdmin: false,
        isMuted: false,
        ping: 20,
        joinedAt: Date.now(),
      };

      const fallbackRoom: CinemaRoomState = {
        ipPort,
        roomName: `Sala Cinema ${ipPort}`,
        maxUsers: 5,
        adminId: '',
        adminName: 'Admin',
        videoState: {
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          title: 'Big Buck Bunny (Ultra HD 4K Remaster)',
          isPlaying: false,
          currentTime: 0,
          updatedAt: Date.now(),
          playbackRate: 1.0,
          duration: 596,
          qualityPreset: 'ultra_4k',
          format: 'html5',
        },
        spectators: [guestUser],
        messages: [],
        announcement: '🍿 Bem-vindos à sessão de Cinema Ultra 4K!',
        isLocked: false,
        adminOnlyControl: true,
      };

      setCurrentUser(guestUser);
      setRoomState(fallbackRoom);

      universalSync.connect(ipPort, guestUser, () => {
        setIsConnecting(false);
        setIsConnected(true);
        cinemaAudio.playCinemaChime();
        showToast('Conectado à Sala de Cinema! 🍿', 'success');
      });
    },
    [showToast]
  );

  const playMedia = useCallback(
    (currentTime?: number) => {
      const now = Date.now();
      const time = currentTime ?? (currentRoomStateRef.current?.videoState.currentTime || 0);

      setRoomState((prev) => (prev ? { ...prev, videoState: { ...prev.videoState, isPlaying: true, currentTime: time, updatedAt: now } } : null));
      universalSync.publish('MEDIA_PLAYED', { currentTime: time, updatedAt: now });
    },
    []
  );

  const pauseMedia = useCallback(
    (currentTime?: number) => {
      const now = Date.now();
      const time = currentTime ?? (currentRoomStateRef.current?.videoState.currentTime || 0);

      setRoomState((prev) => (prev ? { ...prev, videoState: { ...prev.videoState, isPlaying: false, currentTime: time, updatedAt: now } } : null));
      universalSync.publish('MEDIA_PAUSED', { currentTime: time, updatedAt: now });
    },
    []
  );

  const seekMedia = useCallback(
    (time: number) => {
      const now = Date.now();
      setRoomState((prev) => (prev ? { ...prev, videoState: { ...prev.videoState, currentTime: time, updatedAt: now } } : null));
      universalSync.publish('MEDIA_SEEKED', { currentTime: time, updatedAt: now, isPlaying: currentRoomStateRef.current?.videoState.isPlaying });
    },
    []
  );

  const changeMedia = useCallback(
    (url: string, title?: string, duration?: number) => {
      const cleanUrl = url.trim();
      const newVideoState: VideoState = {
        url: cleanUrl,
        title: title?.trim() || 'Filme / Transmissão Ultra 4K',
        isPlaying: false,
        currentTime: 0,
        updatedAt: Date.now(),
        playbackRate: 1.0,
        duration: duration || 0,
        qualityPreset: currentRoomStateRef.current?.videoState.qualityPreset || 'ultra_4k',
        format: (cleanUrl.includes('.m3u8') ? 'hls' : cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be') ? 'youtube' : 'html5'),
      };

      const sysMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        userId: 'system',
        userName: 'Cinema',
        avatar: '🎬',
        text: `Novo vídeo carregado por ${currentUserRef.current?.name || 'Admin'}: "${newVideoState.title}"`,
        timestamp: Date.now(),
        isSystem: true,
      };

      setRoomState((prev) => (prev ? { ...prev, videoState: newVideoState, messages: [...prev.messages, sysMsg] } : null));
      universalSync.publish('MEDIA_CHANGED', { videoState: newVideoState, message: sysMsg });
    },
    []
  );

  const changeQuality = useCallback(
    (preset: QualityPreset) => {
      setRoomState((prev) => (prev ? { ...prev, videoState: { ...prev.videoState, qualityPreset: preset } } : null));
      universalSync.publish('QUALITY_CHANGED', { qualityPreset: preset });
    },
    []
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!currentUserRef.current) return;
      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: currentUserRef.current.id,
        userName: currentUserRef.current.name,
        avatar: currentUserRef.current.avatar,
        text,
        timestamp: Date.now(),
      };
      setRoomState((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : null));
      universalSync.publish('NEW_MESSAGE', { message: msg });
    },
    []
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!currentUserRef.current) return;
      universalSync.publish('REACTION_EMITTED', {
        emoji,
        seatIndex: currentUserRef.current.seatIndex,
      });
    },
    []
  );

  const adminAction = useCallback(
    (action: 'kick' | 'transfer_admin' | 'set_announcement' | 'toggle_admin_control', targetUserId?: string, value?: any) => {
      if (action === 'set_announcement') {
        setRoomState((prev) => (prev ? { ...prev, announcement: value } : null));
      } else if (action === 'toggle_admin_control') {
        setRoomState((prev) => (prev ? { ...prev, adminOnlyControl: value } : null));
      }
      universalSync.publish('ADMIN_ACTION', { action, targetUserId, value });
    },
    []
  );

  const leaveRoom = useCallback(() => {
    universalSync.disconnect();
    setRoomState(null);
    setCurrentUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
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
  };
}
