import { useState, useEffect, useRef, useCallback } from 'react';
import { CinemaRoomState, Spectator, ChatMessage, FloatingReaction, QualityPreset } from '../types/cinema';
import { cinemaAudio } from '../services/soundEffects';
import { peerSync, SyncMessage } from '../services/peerSyncEngine';

interface UseCinemaSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  isP2PMode: boolean;
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
  const [isP2PMode, setIsP2PMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<Spectator | null>(null);
  const [roomState, setRoomState] = useState<CinemaRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; level: 'info' | 'warning' | 'success' } | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [pingMs, setPingMs] = useState(16);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<any>(null);
  const pingTimestampRef = useRef<number>(0);
  const lastAuthRef = useRef<{ mode: 'join' | 'create'; ipPort: string; password: string; roomName?: string; userName?: string; avatar?: string } | null>(null);
  const fallbackTimeoutRef = useRef<any>(null);

  const showToast = useCallback((text: string, level: 'info' | 'warning' | 'success' = 'info') => {
    setToastMessage({ text, level });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  // Handle incoming event from either WebSocket or PeerSync
  const handleIncomingEvent = useCallback((data: SyncMessage) => {
    switch (data.type) {
      case 'PONG': {
        if (data.timestamp) {
          const latency = Math.max(5, Date.now() - data.timestamp);
          setPingMs(latency);
        }
        break;
      }

      case 'ROOM_JOINED': {
        if (data.currentUser) setCurrentUser(data.currentUser);
        if (data.roomState) setRoomState(data.roomState);
        setError(null);
        cinemaAudio.playCinemaChime();
        showToast(
          data.currentUser ? `Bem-vindo! Poltrona ${data.currentUser.seatIndex + 1} reservada` : 'Sala sincronizada!',
          'success'
        );
        break;
      }

      case 'SPECTATOR_JOINED': {
        cinemaAudio.playNotification();
        setRoomState((prev) => {
          if (!prev) return data.roomState || null;
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
        if (data.roomState) setRoomState(data.roomState);
        if (data.message) showToast(`${data.userName} saiu da sala.`, 'info');
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
              updatedAt: data.updatedAt || Date.now(),
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
              updatedAt: data.updatedAt || Date.now(),
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
              updatedAt: data.updatedAt || Date.now(),
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
        showToast(`Filme carregado: ${data.videoState.title}`, 'info');
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
        showToast(`Modo 4K: ${data.qualityPreset.toUpperCase()}`, 'info');
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
        if (data.roomState) setRoomState(data.roomState);
        setCurrentUser((prev) => {
          if (!prev) return null;
          return { ...prev, isAdmin: prev.id === data.newAdminId };
        });
        showToast(`Novo Host da Sala: ${data.newAdminName}`, 'info');
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
          data.adminOnlyControl ? 'Controle exclusivo do Host ativado' : 'Controles liberados para todos',
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
  }, [showToast]);

  // Setup PeerSync listener
  useEffect(() => {
    peerSync.setOnMessage((msg) => {
      handleIncomingEvent(msg);
    });
  }, [handleIncomingEvent]);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setIsConnecting(true);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      // Timeout for static hosts (like Netlify)
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          setIsP2PMode(true);
          setIsConnecting(false);
          setIsConnected(true);
        }
      }, 1500);

      ws.onopen = () => {
        if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
        setIsConnected(true);
        setIsConnecting(false);
        setIsP2PMode(false);
        setError(null);

        // Ping loop
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            pingTimestampRef.current = Date.now();
            ws.send(JSON.stringify({ type: 'PING', timestamp: pingTimestampRef.current }));
          }
        }, 5000);

        // Rejoin on reconnect
        if (lastAuthRef.current) {
          const auth = lastAuthRef.current;
          if (auth.mode === 'create') {
            ws.send(JSON.stringify({
              type: 'CREATE_ROOM',
              ipPort: auth.ipPort,
              password: auth.password,
              roomName: auth.roomName,
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
          handleIncomingEvent(data);
        } catch (err) {
          console.error('Error decoding WS message:', err);
        }
      };

      ws.onerror = () => {
        setIsP2PMode(true);
        setIsConnecting(false);
        setIsConnected(true);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };
    } catch (e) {
      setIsP2PMode(true);
      setIsConnecting(false);
      setIsConnected(true);
    }
  }, [handleIncomingEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect]);

  // Unified send method (WebSocket or P2P/Broadcast)
  const sendPayload = useCallback((payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && !isP2PMode) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      // P2P / PeerSync Engine
      peerSync.broadcastMessage(payload);
    }
  }, [isP2PMode]);

  const joinRoom = useCallback(
    (ipPort: string, password: string, userName?: string, avatar?: string) => {
      setError(null);
      lastAuthRef.current = { mode: 'join', ipPort, password, userName, avatar };

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && !isP2PMode) {
        socketRef.current.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            ipPort,
            password,
            userName,
            avatar,
          })
        );
      } else {
        // Fallback local/P2P instant join
        const result = peerSync.joinRoomLocally(ipPort, password, userName, avatar);
        if (result.error) {
          setError(result.error);
          showToast(result.error, 'warning');
        } else if (result.user && result.room) {
          setCurrentUser(result.user);
          setRoomState(result.room);
          cinemaAudio.playCinemaChime();
          showToast(`Entrou na Sala! Poltrona ${result.user.seatIndex + 1} reservada`, 'success');
        }
      }
    },
    [isP2PMode, showToast]
  );

  const createRoom = useCallback(
    (ipPort: string, password: string, roomName?: string, userName?: string, avatar?: string) => {
      setError(null);
      lastAuthRef.current = { mode: 'create', ipPort, password, roomName, userName, avatar };

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && !isP2PMode) {
        socketRef.current.send(
          JSON.stringify({
            type: 'CREATE_ROOM',
            ipPort,
            password,
            roomName,
            userName,
            avatar,
          })
        );
      } else {
        // Fallback local/P2P instant room creation
        const { user, room } = peerSync.createRoomLocally(ipPort, password, roomName, userName, avatar);
        setCurrentUser(user);
        setRoomState(room);
        cinemaAudio.playCinemaChime();
        showToast('Sala de Cinema criada com sucesso! 🎬', 'success');
      }
    },
    [isP2PMode, showToast]
  );

  const playMedia = useCallback(
    (currentTime?: number) => {
      const now = Date.now();
      const time = currentTime ?? (roomState?.videoState.currentTime || 0);
      if (isP2PMode) {
        setRoomState((prev) => (prev ? { ...prev, videoState: { ...prev.videoState, isPlaying: true, currentTime: time, updatedAt: now } } : null));
      }
      sendPayload({ type: 'MEDIA_PLAYED', currentTime: time, updatedAt: now, triggeredBy: currentUser?.name || 'Admin' });
    },
    [sendPayload, roomState, currentUser, isP2PMode]
  );

  const pauseMedia = useCallback(
    (currentTime?: number) => {
      const now = Date.now();
      const time = currentTime ?? (roomState?.videoState.currentTime || 0);
      if (isP2PMode) {
        setRoomState((prev) => (prev ? { ...prev, videoState: { ...prev.videoState, isPlaying: false, currentTime: time, updatedAt: now } } : null));
      }
      sendPayload({ type: 'MEDIA_PAUSED', currentTime: time, updatedAt: now, triggeredBy: currentUser?.name || 'Admin' });
    },
    [sendPayload, roomState, currentUser, isP2PMode]
  );

  const seekMedia = useCallback(
    (time: number) => {
      const now = Date.now();
      if (isP2PMode) {
        setRoomState((prev) => (prev ? { ...prev, videoState: { ...prev.videoState, currentTime: time, updatedAt: now } } : null));
      }
      sendPayload({ type: 'MEDIA_SEEKED', currentTime: time, updatedAt: now, isPlaying: roomState?.videoState.isPlaying });
    },
    [sendPayload, roomState, isP2PMode]
  );

  const changeMedia = useCallback(
    (url: string, title?: string, duration?: number) => {
      const newVideoState = {
        url: url.trim(),
        title: title?.trim() || 'Filme / Vídeo Ultra 4K',
        isPlaying: false,
        currentTime: 0,
        updatedAt: Date.now(),
        playbackRate: 1.0,
        duration: duration || 0,
        qualityPreset: roomState?.videoState.qualityPreset || 'ultra_4k',
        format: (url.includes('.m3u8') ? 'hls' : url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' : 'html5') as any,
      };

      const sysMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        userId: 'system',
        userName: 'Cinema',
        avatar: '🎬',
        text: `Novo vídeo carregado por ${currentUser?.name || 'Host'}: "${newVideoState.title}"`,
        timestamp: Date.now(),
        isSystem: true,
      };

      if (isP2PMode) {
        setRoomState((prev) => (prev ? { ...prev, videoState: newVideoState, messages: [...prev.messages, sysMsg] } : null));
      }

      sendPayload({
        type: 'MEDIA_CHANGED',
        videoState: newVideoState,
        message: sysMsg,
      });
    },
    [sendPayload, roomState, currentUser, isP2PMode]
  );

  const changeQuality = useCallback(
    (preset: QualityPreset) => {
      if (isP2PMode) {
        setRoomState((prev) => (prev ? { ...prev, videoState: { ...prev.videoState, qualityPreset: preset } } : null));
      }
      sendPayload({ type: 'QUALITY_CHANGED', qualityPreset: preset });
    },
    [sendPayload, isP2PMode]
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!currentUser) return;
      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: currentUser.id,
        userName: currentUser.name,
        avatar: currentUser.avatar,
        text,
        timestamp: Date.now(),
      };
      if (isP2PMode) {
        setRoomState((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : null));
      }
      sendPayload({ type: 'NEW_MESSAGE', message: msg });
    },
    [sendPayload, currentUser, isP2PMode]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!currentUser) return;
      sendPayload({
        type: 'REACTION_EMITTED',
        emoji,
        userName: currentUser.name,
        userId: currentUser.id,
        seatIndex: currentUser.seatIndex,
        timestamp: Date.now(),
      });
    },
    [sendPayload, currentUser]
  );

  const adminAction = useCallback(
    (action: 'kick' | 'transfer_admin' | 'set_announcement' | 'toggle_admin_control', targetUserId?: string, value?: any) => {
      if (action === 'set_announcement') {
        if (isP2PMode) {
          setRoomState((prev) => (prev ? { ...prev, announcement: value } : null));
        }
        sendPayload({ type: 'ANNOUNCEMENT_UPDATED', announcement: value });
      } else if (action === 'toggle_admin_control') {
        if (isP2PMode) {
          setRoomState((prev) => (prev ? { ...prev, adminOnlyControl: value } : null));
        }
        sendPayload({ type: 'ADMIN_CONTROL_TOGGLED', adminOnlyControl: value });
      } else if (action === 'transfer_admin' && targetUserId) {
        const target = roomState?.spectators.find((s) => s.id === targetUserId);
        if (target) {
          sendPayload({
            type: 'ADMIN_TRANSFERRED',
            newAdminId: target.id,
            newAdminName: target.name,
            roomState: roomState ? {
              ...roomState,
              adminId: target.id,
              adminName: target.name,
              spectators: roomState.spectators.map((s) => ({
                ...s,
                isAdmin: s.id === target.id,
              })),
            } : null,
          });
        }
      } else if (action === 'kick' && targetUserId) {
        const target = roomState?.spectators.find((s) => s.id === targetUserId);
        if (target) {
          sendPayload({
            type: 'SPECTATOR_LEFT',
            userId: target.id,
            userName: target.name,
            roomState: roomState ? {
              ...roomState,
              spectators: roomState.spectators.filter((s) => s.id !== target.id),
            } : null,
          });
        }
      }
    },
    [sendPayload, isP2PMode, roomState]
  );

  const leaveRoom = useCallback(() => {
    lastAuthRef.current = null;
    sendPayload({ type: 'LEAVE_ROOM' });
    peerSync.cleanUp();
    setRoomState(null);
    setCurrentUser(null);
  }, [sendPayload]);

  const clearError = useCallback(() => setError(null), []);

  return {
    isConnected,
    isConnecting,
    isP2PMode,
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
