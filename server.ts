import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory Cinema Rooms storage
export interface Spectator {
  id: string;
  name: string;
  avatar: string;
  seatIndex: number;
  isAdmin: boolean;
  isMuted: boolean;
  ping: number;
  joinedAt: number;
  ws?: WebSocket;
}

export interface VideoState {
  url: string;
  title: string;
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number;
  playbackRate: number;
  duration: number;
  qualityPreset: 'original' | 'ultra_4k' | 'hdr_vibrant' | 'crisp_sharp' | 'cyberpunk';
  format: 'html5' | 'hls' | 'youtube';
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface CinemaRoom {
  ipPort: string;
  password: string;
  roomName: string;
  createdAt: number;
  maxUsers: number;
  adminId: string;
  adminName: string;
  videoState: VideoState;
  spectators: Map<string, Spectator>;
  messages: ChatMessage[];
  announcement: string | null;
  isLocked: boolean;
  adminOnlyControl: boolean;
}

const rooms = new Map<string, CinemaRoom>();

// Normalize IP/Port code format
function normalizeIpPort(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

// Pre-populate demo room
const defaultDemoRoom: CinemaRoom = {
  ipPort: '192.168.1.100:8080',
  password: '123',
  roomName: 'Sala VIP Cinema 4K',
  createdAt: Date.now(),
  maxUsers: 5,
  adminId: '',
  adminName: 'Sistema',
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
  spectators: new Map(),
  messages: [
    {
      id: 'welcome-1',
      userId: 'system',
      userName: 'CineBot',
      avatar: '🎬',
      text: 'Bem-vindo à Sala de Cinema! Capacidade máxima: 5 espectadores. O Admin controla o painel de reprodução.',
      timestamp: Date.now(),
      isSystem: true,
    },
  ],
  announcement: '🍿 Bem-vindos à sessão de Cinema Ultra 4K!',
  isLocked: false,
  adminOnlyControl: true,
};
rooms.set(defaultDemoRoom.ipPort, defaultDemoRoom);

// REST API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size, timestamp: Date.now() });
});

app.get('/api/rooms/check', (req, res) => {
  const rawIpPort = req.query.ipPort as string;
  if (!rawIpPort) {
    return res.status(400).json({ error: 'IP da porta é obrigatório' });
  }
  const ipPort = normalizeIpPort(rawIpPort);
  const room = rooms.get(ipPort);
  if (!room) {
    return res.json({ exists: false });
  }

  return res.json({
    exists: true,
    ipPort: room.ipPort,
    roomName: room.roomName,
    spectatorCount: room.spectators.size,
    maxUsers: room.maxUsers,
    isFull: room.spectators.size >= room.maxUsers,
    hasPassword: Boolean(room.password),
    currentVideoTitle: room.videoState.title,
  });
});

app.get('/api/rooms/popular', (req, res) => {
  const list = Array.from(rooms.values()).map((r) => ({
    ipPort: r.ipPort,
    roomName: r.roomName,
    spectatorCount: r.spectators.size,
    maxUsers: r.maxUsers,
    isFull: r.spectators.size >= r.maxUsers,
    videoTitle: r.videoState.title,
  }));
  res.json(list);
});

// WebSocket Server attached to same HTTP Server
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastToRoom(room: CinemaRoom, message: any, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  room.spectators.forEach((spectator) => {
    if (spectator.ws && spectator.ws.readyState === WebSocket.OPEN && spectator.ws !== excludeWs) {
      try {
        spectator.ws.send(payload);
      } catch (err) {
        console.error('Error broadcasting to spectator:', err);
      }
    }
  });
}

function getSanitizedRoomData(room: CinemaRoom) {
  return {
    ipPort: room.ipPort,
    roomName: room.roomName,
    maxUsers: room.maxUsers,
    adminId: room.adminId,
    adminName: room.adminName,
    videoState: room.videoState,
    announcement: room.announcement,
    isLocked: room.isLocked,
    adminOnlyControl: room.adminOnlyControl,
    spectators: Array.from(room.spectators.values()).map((s) => ({
      id: s.id,
      name: s.name,
      avatar: s.avatar,
      seatIndex: s.seatIndex,
      isAdmin: s.isAdmin,
      isMuted: s.isMuted,
      ping: s.ping,
      joinedAt: s.joinedAt,
    })),
    messages: room.messages.slice(-50),
  };
}

wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;
  let isAlive = true;

  ws.on('pong', () => {
    isAlive = true;
  });

  ws.on('message', (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());
      const type = data.type;

      switch (type) {
        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: data.timestamp, serverTime: Date.now() }));
          if (currentRoomId && currentUserId) {
            const room = rooms.get(currentRoomId);
            const user = room?.spectators.get(currentUserId);
            if (user && data.ping !== undefined) {
              user.ping = data.ping;
            }
          }
          break;
        }

        case 'CREATE_ROOM': {
          const { ipPort: rawIp, password, roomName, userName, avatar } = data;
          if (!rawIp || !password) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'IP da porta e senha são obrigatórios.' }));
            return;
          }
          const ipPort = normalizeIpPort(rawIp);
          if (rooms.has(ipPort)) {
            const existing = rooms.get(ipPort)!;
            if (existing.password && existing.password !== password) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Uma sala com esse IP da porta já existe e a senha está incorreta.' }));
              return;
            }
          } else {
            // Create new room
            const newRoom: CinemaRoom = {
              ipPort,
              password,
              roomName: roomName?.trim() || `Sala Cinema ${ipPort}`,
              createdAt: Date.now(),
              maxUsers: 5,
              adminId: '',
              adminName: userName || 'Admin',
              videoState: {
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
                title: 'Tears of Steel (Ultra 4K Sci-Fi Demo)',
                isPlaying: false,
                currentTime: 0,
                updatedAt: Date.now(),
                playbackRate: 1.0,
                duration: 734,
                qualityPreset: 'ultra_4k',
                format: 'html5',
              },
              spectators: new Map(),
              messages: [],
              announcement: '🎬 Sala criada com sucesso! Prepare a pipoca.',
              isLocked: false,
              adminOnlyControl: true,
            };
            rooms.set(ipPort, newRoom);
          }

          // Fallthrough to join
          handleJoinRoom(ipPort, password, userName, avatar);
          break;
        }

        case 'JOIN_ROOM': {
          const { ipPort: rawIp, password, userName, avatar } = data;
          if (!rawIp) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Informe o IP da porta.' }));
            return;
          }
          const ipPort = normalizeIpPort(rawIp);
          handleJoinRoom(ipPort, password, userName, avatar);
          break;
        }

        case 'SYNC_PLAY': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const user = room.spectators.get(currentUserId);
          if (room.adminOnlyControl && !user?.isAdmin) {
            ws.send(JSON.stringify({ type: 'TOAST', message: 'Apenas o Admin pode controlar a reprodução.', level: 'warning' }));
            return;
          }

          const currentTime = typeof data.currentTime === 'number' ? data.currentTime : room.videoState.currentTime;
          room.videoState.isPlaying = true;
          room.videoState.currentTime = currentTime;
          room.videoState.updatedAt = Date.now();

          broadcastToRoom(room, {
            type: 'MEDIA_PLAYED',
            currentTime,
            updatedAt: room.videoState.updatedAt,
            triggeredBy: user?.name || 'Admin',
          });
          break;
        }

        case 'SYNC_PAUSE': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const user = room.spectators.get(currentUserId);
          if (room.adminOnlyControl && !user?.isAdmin) {
            ws.send(JSON.stringify({ type: 'TOAST', message: 'Apenas o Admin pode pausar o filme.', level: 'warning' }));
            return;
          }

          const currentTime = typeof data.currentTime === 'number' ? data.currentTime : room.videoState.currentTime;
          room.videoState.isPlaying = false;
          room.videoState.currentTime = currentTime;
          room.videoState.updatedAt = Date.now();

          broadcastToRoom(room, {
            type: 'MEDIA_PAUSED',
            currentTime,
            updatedAt: room.videoState.updatedAt,
            triggeredBy: user?.name || 'Admin',
          });
          break;
        }

        case 'SYNC_SEEK': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const user = room.spectators.get(currentUserId);
          if (room.adminOnlyControl && !user?.isAdmin) {
            ws.send(JSON.stringify({ type: 'TOAST', message: 'Apenas o Admin pode avançar/voltar o vídeo.', level: 'warning' }));
            return;
          }

          const currentTime = typeof data.currentTime === 'number' ? data.currentTime : 0;
          room.videoState.currentTime = currentTime;
          room.videoState.updatedAt = Date.now();

          broadcastToRoom(room, {
            type: 'MEDIA_SEEKED',
            currentTime,
            updatedAt: room.videoState.updatedAt,
            isPlaying: room.videoState.isPlaying,
            triggeredBy: user?.name || 'Admin',
          });
          break;
        }

        case 'CHANGE_MEDIA': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const user = room.spectators.get(currentUserId);
          if (room.adminOnlyControl && !user?.isAdmin) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Apenas o Admin pode alterar o link do vídeo.' }));
            return;
          }

          const { url, title, duration, format } = data;
          if (!url) return;

          room.videoState = {
            url: url.trim(),
            title: title?.trim() || 'Filme / Transmissão Ultra 4K',
            isPlaying: false,
            currentTime: 0,
            updatedAt: Date.now(),
            playbackRate: 1.0,
            duration: duration || 0,
            qualityPreset: room.videoState.qualityPreset || 'ultra_4k',
            format: format || (url.includes('.m3u8') ? 'hls' : url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' : 'html5'),
          };

          const sysMsg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            userId: 'system',
            userName: 'Cinema',
            avatar: '🎬',
            text: `Novo vídeo carregado por ${user?.name || 'Admin'}: "${room.videoState.title}"`,
            timestamp: Date.now(),
            isSystem: true,
          };
          room.messages.push(sysMsg);

          broadcastToRoom(room, {
            type: 'MEDIA_CHANGED',
            videoState: room.videoState,
            message: sysMsg,
          });
          break;
        }

        case 'CHANGE_QUALITY': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const preset = data.qualityPreset;
          if (preset) {
            room.videoState.qualityPreset = preset;
            broadcastToRoom(room, {
              type: 'QUALITY_CHANGED',
              qualityPreset: preset,
            });
          }
          break;
        }

        case 'SEND_MESSAGE': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const user = room.spectators.get(currentUserId);
          if (!user) return;
          const text = (data.text || '').trim();
          if (!text) return;

          const msg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            userId: user.id,
            userName: user.name,
            avatar: user.avatar,
            text,
            timestamp: Date.now(),
          };
          room.messages.push(msg);
          if (room.messages.length > 100) room.messages.shift();

          broadcastToRoom(room, {
            type: 'NEW_MESSAGE',
            message: msg,
          });
          break;
        }

        case 'SEND_REACTION': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const user = room.spectators.get(currentUserId);
          if (!user) return;

          broadcastToRoom(room, {
            type: 'REACTION_EMITTED',
            emoji: data.emoji || '🍿',
            userName: user.name,
            userId: user.id,
            seatIndex: user.seatIndex,
            timestamp: Date.now(),
          });
          break;
        }

        case 'ADMIN_ACTION': {
          if (!currentRoomId || !currentUserId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const user = room.spectators.get(currentUserId);
          if (!user?.isAdmin) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Permissão negada. Apenas Admin.' }));
            return;
          }

          const { action, targetUserId, value } = data;
          if (action === 'kick' && targetUserId) {
            const target = room.spectators.get(targetUserId);
            if (target && !target.isAdmin) {
              if (target.ws && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(JSON.stringify({ type: 'KICKED', message: 'Você foi removido da sala pelo administrador.' }));
                target.ws.close();
              }
              room.spectators.delete(targetUserId);
              broadcastToRoom(room, {
                type: 'SPECTATOR_LEFT',
                userId: targetUserId,
                userName: target.name,
                roomState: getSanitizedRoomData(room),
              });
            }
          } else if (action === 'transfer_admin' && targetUserId) {
            const target = room.spectators.get(targetUserId);
            if (target) {
              user.isAdmin = false;
              target.isAdmin = true;
              room.adminId = target.id;
              room.adminName = target.name;
              broadcastToRoom(room, {
                type: 'ADMIN_TRANSFERRED',
                newAdminId: target.id,
                newAdminName: target.name,
                roomState: getSanitizedRoomData(room),
              });
            }
          } else if (action === 'set_announcement') {
            room.announcement = typeof value === 'string' ? value.trim() : null;
            broadcastToRoom(room, {
              type: 'ANNOUNCEMENT_UPDATED',
              announcement: room.announcement,
            });
          } else if (action === 'toggle_admin_control') {
            room.adminOnlyControl = Boolean(value);
            broadcastToRoom(room, {
              type: 'ADMIN_CONTROL_TOGGLED',
              adminOnlyControl: room.adminOnlyControl,
            });
          }
          break;
        }

        case 'LEAVE_ROOM': {
          handleLeaveRoom();
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  function handleJoinRoom(ipPort: string, passwordAttempt: string, rawUserName?: string, avatarIcon?: string) {
    const room = rooms.get(ipPort);
    if (!room) {
      ws.send(JSON.stringify({ type: 'ERROR', message: `Sala "${ipPort}" não encontrada. Verifique o IP da porta ou crie uma nova sala.` }));
      return;
    }

    if (room.password && room.password !== passwordAttempt) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Senha da porta incorreta! Tente novamente.' }));
      return;
    }

    // STRICT 5-PERSON CAPACITY LIMIT
    if (room.spectators.size >= room.maxUsers) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: `Sala cheia! Limite máximo de ${room.maxUsers} pessoas atingido. Aguarde alguém sair.`,
      }));
      return;
    }

    // Find first available seat 0 to 4
    const takenSeats = new Set(Array.from(room.spectators.values()).map((s) => s.seatIndex));
    let assignedSeat = 0;
    for (let i = 0; i < room.maxUsers; i++) {
      if (!takenSeats.has(i)) {
        assignedSeat = i;
        break;
      }
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const isFirstUser = room.spectators.size === 0;
    const userName = rawUserName?.trim() || (isFirstUser ? 'Admin Cineasta' : `Espectador #${assignedSeat + 1}`);
    const avatarList = ['🍿', '🕶️', '🥤', '🎬', '🎟️', '⭐', '🪐', '🦁'];
    const avatar = avatarIcon || avatarList[assignedSeat % avatarList.length];

    const isAdmin = isFirstUser || room.adminId === '';
    if (isAdmin) {
      room.adminId = userId;
      room.adminName = userName;
    }

    const spectator: Spectator = {
      id: userId,
      name: userName,
      avatar,
      seatIndex: assignedSeat,
      isAdmin,
      isMuted: false,
      ping: 25,
      joinedAt: Date.now(),
      ws,
    };

    room.spectators.set(userId, spectator);
    currentRoomId = ipPort;
    currentUserId = userId;

    const joinMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: 'system',
      userName: 'Cinema',
      avatar: '🎟️',
      text: `${userName} entrou na sala e ocupou a Poltrona ${assignedSeat + 1}! (${room.spectators.size}/${room.maxUsers})`,
      timestamp: Date.now(),
      isSystem: true,
    };
    room.messages.push(joinMessage);

    // Send successful response to current user
    ws.send(JSON.stringify({
      type: 'ROOM_JOINED',
      currentUser: {
        id: spectator.id,
        name: spectator.name,
        avatar: spectator.avatar,
        seatIndex: spectator.seatIndex,
        isAdmin: spectator.isAdmin,
      },
      roomState: getSanitizedRoomData(room),
    }));

    // Broadcast to others
    broadcastToRoom(room, {
      type: 'SPECTATOR_JOINED',
      spectator: {
        id: spectator.id,
        name: spectator.name,
        avatar: spectator.avatar,
        seatIndex: spectator.seatIndex,
        isAdmin: spectator.isAdmin,
        isMuted: spectator.isMuted,
        ping: spectator.ping,
        joinedAt: spectator.joinedAt,
      },
      message: joinMessage,
      spectatorCount: room.spectators.size,
    }, ws);
  }

  function handleLeaveRoom() {
    if (!currentRoomId || !currentUserId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const spectator = room.spectators.get(currentUserId);
    if (spectator) {
      room.spectators.delete(currentUserId);
      const leaveMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: 'system',
        userName: 'Cinema',
        avatar: '👋',
        text: `${spectator.name} liberou a Poltrona ${spectator.seatIndex + 1}. (${room.spectators.size}/${room.maxUsers})`,
        timestamp: Date.now(),
        isSystem: true,
      };
      room.messages.push(leaveMessage);

      // If admin left, pass admin to next user
      if (spectator.isAdmin && room.spectators.size > 0) {
        const nextUser = room.spectators.values().next().value;
        if (nextUser) {
          nextUser.isAdmin = true;
          room.adminId = nextUser.id;
          room.adminName = nextUser.name;
        }
      }

      broadcastToRoom(room, {
        type: 'SPECTATOR_LEFT',
        userId: currentUserId,
        userName: spectator.name,
        message: leaveMessage,
        roomState: getSanitizedRoomData(room),
      });
    }

    currentRoomId = null;
    currentUserId = null;
  }

  ws.on('close', () => {
    handleLeaveRoom();
  });
});

// Heartbeat checker for active WebSocket connections
setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, 30000);

// Vite middleware for development & static files in production
async function setupVite() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 CineRoom Ultra 4K Server rodando na porta ${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('Falha ao inicializar servidor CineRoom:', err);
});
