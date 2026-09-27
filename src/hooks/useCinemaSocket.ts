import { useState, useEffect, useRef, useCallback } from 'react';
import { CinemaRoomState, Spectator, ChatMessage, FloatingReaction, QualityPreset } from '../types/cinema';
import { cinemaAudio } from '../services/soundEffects';

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
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentUser, setCurrentUser] = useState<Spectator | null>(null);
  const [roomState, setRoomState] = useState<CinemaRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; level: 'info' | 'warning' | 'success' } | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [pingMs, setPingMs] = useState(18);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const pingTimestampRef = useRef<number>(0);
  const lastAuthRef = useRef<{ mode: 'join' | 'create'; ipPort: string; password: string; userName?: string; avatar?: string } | null>(null);

  const showToast = useCallback((text: string, level: 'info' | 'warning' | 'success' = 'info') => {
    setToastMessage({ text, level });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setIsConnecting(true);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);

      // Start ping loop
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pingTimestampRef.current = Date.now();
          ws.send(JSON.stringify({ type: 'PING', timestamp: pingTimestampRef.current, ping: pingMs }));
        }
      }, 5000);

      // Auto rejoin if reconnected after drop
      if (lastAuthRef.current) {
        const auth = lastAuthRef.current;
        if (auth.mode === 'create') {
          ws.send(JSON.stringify({
            type: 'CREATE_ROOM',
            ipPort: auth.ipPort,
            password: auth.password,
            userName: auth.userName,
            avatar: auth.avatar,
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'JOIN_ROOM',
            ipPort: auth.ipPort,
            password: auth.password,
            userName: auth.userName,
            avatar: auth.avatar,
          }));
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'PONG': {
            if (data.timestamp) {
              const latency = Math.max(5, Date.now() - data.timestamp);
              setPingMs(latency);
            }
            break;
          }

          case 'ROOM_JOINED': {
            setCurrentUser(data.currentUser);
            setRoomState(data.roomState);
            setError(null);
            cinemaAudio.playCinemaChime();
            showToast(`Bem-vindo à sala! Poltrona ${data.currentUser.seatIndex + 1} reservada`, 'success');
            break;
          }

          case 'SPECTATOR_JOINED': {
            cinemaAudio.playNotification();
            setRoomState((prev) => {
              if (!prev) return null;
              const exists = prev.spectators.some((s) => s.id === data.spectator.id);
              const updatedSpectators = exists ? prev.spectators : [...prev.spectators, data.spectator];
              return {
                ...prev,
                spectators: updatedSpectators,
                messages: data.message ? [...prev.messages, data.message] : prev.messages,
              };
            });
            showToast(`${data.spectator.name} entrou na sala!`, 'info');
            break;
          }

          case 'SPECTATOR_LEFT': {
            setRoomState(data.roomState);
            if (data.message) {
              showToast(`${data.userName} saiu da sala.`, 'info');
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
                  currentTime: data.currentTime,
                  updatedAt: data.updatedAt,
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
                  currentTime: data.currentTime,
                  updatedAt: data.updatedAt,
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
                  currentTime: data.currentTime,
                  updatedAt: data.updatedAt,
                  isPlaying: data.isPlaying ?? prev.videoState.isPlaying,
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
                videoState: data.videoState,
                messages: data.message ? [...prev.messages, data.message] : prev.messages,
              };
            });
            showToast(`Filme alterado: ${data.videoState.title}`, 'info');
            break;
          }

          case 'QUALITY_CHANGED': {
            setRoomState((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                videoState: {
                  ...prev.videoState,
                  qualityPreset: data.qualityPreset,
                },
              };
            });
            showToast(`Modo de Imagem: ${data.qualityPreset.toUpperCase()}`, 'info');
            break;
          }

          case 'NEW_MESSAGE': {
            cinemaAudio.playNotification();
            setRoomState((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                messages: [...prev.messages, data.message],
              };
            });
            break;
          }

          case 'REACTION_EMITTED': {
            if (data.emoji === '🍿') cinemaAudio.playPopcorn();
            else if (data.emoji === '👏') cinemaAudio.playApplause();
            else cinemaAudio.playPopcorn();

            const reaction: FloatingReaction = {
              id: `rx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              emoji: data.emoji,
              userName: data.userName,
              userId: data.userId,
              seatIndex: data.seatIndex ?? 0,
              x: 10 + Math.random() * 80,
              timestamp: Date.now(),
            };

            setFloatingReactions((prev) => [...prev.slice(-15), reaction]);
            setTimeout(() => {
              setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
            }, 3500);
            break;
          }

          case 'ADMIN_TRANSFERRED': {
            setRoomState(data.roomState);
            setCurrentUser((prev) => {
              if (!prev) return null;
              return { ...prev, isAdmin: prev.id === data.newAdminId };
            });
            showToast(`Novo Administrador da Sala: ${data.newAdminName}`, 'info');
            break;
          }

          case 'ANNOUNCEMENT_UPDATED': {
            setRoomState((prev) => {
              if (!prev) return null;
              return { ...prev, announcement: data.announcement };
            });
            break;
          }

          case 'ADMIN_CONTROL_TOGGLED': {
            setRoomState((prev) => {
              if (!prev) return null;
              return { ...prev, adminOnlyControl: data.adminOnlyControl };
            });
            showToast(
              data.adminOnlyControl ? 'Controle exclusivo do Admin ativado' : 'Controles liberados para todos os espectadores',
              'info'
            );
            break;
          }

          case 'KICKED': {
            setError(data.message || 'Você foi removido da sala.');
            setRoomState(null);
            setCurrentUser(null);
            lastAuthRef.current = null;
            break;
          }

          case 'TOAST': {
            showToast(data.message, data.level || 'info');
            break;
          }

          case 'ERROR': {
            setError(data.message);
            showToast(data.message, 'warning');
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Error decoding WS message:', err);
      }
    };

    ws.onerror = () => {
      setIsConnecting(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

      // Attempt auto-reconnect if user was inside room
      if (lastAuthRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };
  }, [pingMs, showToast]);

  useEffect(() => {
    connect();
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const sendPayload = useCallback((payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      showToast('Conectando ao servidor...', 'warning');
      connect();
    }
  }, [connect, showToast]);

  const joinRoom = useCallback(
    (ipPort: string, password: string, userName?: string, avatar?: string) => {
      setError(null);
      lastAuthRef.current = { mode: 'join', ipPort, password, userName, avatar };
      sendPayload({
        type: 'JOIN_ROOM',
        ipPort,
        password,
        userName,
        avatar,
      });
    },
    [sendPayload]
  );

  const createRoom = useCallback(
    (ipPort: string, password: string, roomName?: string, userName?: string, avatar?: string) => {
      setError(null);
      lastAuthRef.current = { mode: 'create', ipPort, password, userName, avatar };
      sendPayload({
        type: 'CREATE_ROOM',
        ipPort,
        password,
        roomName,
        userName,
        avatar,
      });
    },
    [sendPayload]
  );

  const playMedia = useCallback(
    (currentTime?: number) => {
      sendPayload({ type: 'SYNC_PLAY', currentTime });
    },
    [sendPayload]
  );

  const pauseMedia = useCallback(
    (currentTime?: number) => {
      sendPayload({ type: 'SYNC_PAUSE', currentTime });
    },
    [sendPayload]
  );

  const seekMedia = useCallback(
    (time: number) => {
      sendPayload({ type: 'SYNC_SEEK', currentTime: time });
    },
    [sendPayload]
  );

  const changeMedia = useCallback(
    (url: string, title?: string, duration?: number) => {
      sendPayload({ type: 'CHANGE_MEDIA', url, title, duration });
    },
    [sendPayload]
  );

  const changeQuality = useCallback(
    (preset: QualityPreset) => {
      sendPayload({ type: 'CHANGE_QUALITY', qualityPreset: preset });
    },
    [sendPayload]
  );

  const sendMessage = useCallback(
    (text: string) => {
      sendPayload({ type: 'SEND_MESSAGE', text });
    },
    [sendPayload]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      sendPayload({ type: 'SEND_REACTION', emoji });
    },
    [sendPayload]
  );

  const adminAction = useCallback(
    (action: 'kick' | 'transfer_admin' | 'set_announcement' | 'toggle_admin_control', targetUserId?: string, value?: any) => {
      sendPayload({ type: 'ADMIN_ACTION', action, targetUserId, value });
    },
    [sendPayload]
  );

  const leaveRoom = useCallback(() => {
    lastAuthRef.current = null;
    sendPayload({ type: 'LEAVE_ROOM' });
    setRoomState(null);
    setCurrentUser(null);
  }, [sendPayload]);

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
