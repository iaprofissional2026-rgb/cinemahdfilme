import Peer, { DataConnection } from 'peerjs';
import { CinemaRoomState, Spectator, ChatMessage, QualityPreset } from '../types/cinema';

export interface SyncMessage {
  type: string;
  [key: string]: any;
}

export type MessageCallback = (data: SyncMessage) => void;

class PeerSyncEngine {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private onMessageCallback: MessageCallback | null = null;
  private currentRoomState: CinemaRoomState | null = null;
  private currentUser: Spectator | null = null;
  private isHost: boolean = false;
  private normalizedRoomId: string = '';

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('cineroom_broadcast_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (this.onMessageCallback && event.data) {
            this.handleIncomingMessage(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported in this environment');
      }
    }
  }

  public setOnMessage(cb: MessageCallback) {
    this.onMessageCallback = cb;
  }

  private sanitizeId(ipPort: string): string {
    return ipPort.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  // Create room locally & as WebRTC Host
  public createRoomLocally(
    ipPort: string,
    password: string,
    roomName?: string,
    userName?: string,
    avatar?: string
  ): { user: Spectator; room: CinemaRoomState } {
    this.normalizedRoomId = this.sanitizeId(ipPort);
    this.isHost = true;

    const hostUser: Spectator = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: userName?.trim() || 'Admin Cineasta',
      avatar: avatar || '🎬',
      seatIndex: 0,
      isAdmin: true,
      isMuted: false,
      ping: 15,
      joinedAt: Date.now(),
    };

    const newRoom: CinemaRoomState = {
      roomId: ipPort,
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

    this.currentUser = hostUser;
    this.currentRoomState = newRoom;

    // Save to localStorage for instant local/tab sync
    try {
      localStorage.setItem(`cineroom_${this.normalizedRoomId}_pwd`, password);
      localStorage.setItem(`cineroom_${this.normalizedRoomId}_state`, JSON.stringify(newRoom));
    } catch (e) {}

    this.initPeerAsHost();

    return { user: hostUser, room: newRoom };
  }

  // Join room locally / via WebRTC Host
  public joinRoomLocally(
    ipPort: string,
    passwordAttempt: string,
    userName?: string,
    avatar?: string
  ): { user?: Spectator; room?: CinemaRoomState; error?: string } {
    this.normalizedRoomId = this.sanitizeId(ipPort);

    // Check stored state if exists
    let existingState: CinemaRoomState | null = null;
    let savedPwd = '';
    try {
      savedPwd = localStorage.getItem(`cineroom_${this.normalizedRoomId}_pwd`) || '';
      const raw = localStorage.getItem(`cineroom_${this.normalizedRoomId}_state`);
      if (raw) {
        existingState = JSON.parse(raw);
      }
    } catch (e) {}

    if (savedPwd && savedPwd !== passwordAttempt) {
      return { error: 'Senha da porta incorreta! Verifique a senha digitada.' };
    }

    if (existingState && existingState.spectators.length >= existingState.maxUsers) {
      return { error: `Sala cheia! Limite máximo de ${existingState.maxUsers} pessoas atingido.` };
    }

    const takenSeats = new Set(existingState?.spectators.map((s) => s.seatIndex) || []);
    let assignedSeat = 0;
    for (let i = 0; i < 5; i++) {
      if (!takenSeats.has(i)) {
        assignedSeat = i;
        break;
      }
    }

    const isFirst = !existingState || existingState.spectators.length === 0;
    const user: Spectator = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: userName?.trim() || (isFirst ? 'Admin Cineasta' : `Espectador #${assignedSeat + 1}`),
      avatar: avatar || (isFirst ? '🎬' : '🍿'),
      seatIndex: assignedSeat,
      isAdmin: isFirst,
      isMuted: false,
      ping: 20,
      joinedAt: Date.now(),
    };

    const room: CinemaRoomState = existingState || {
      roomId: ipPort,
      ipPort,
      roomName: `Sala Cinema ${ipPort}`,
      maxUsers: 5,
      adminId: user.id,
      adminName: user.name,
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
      spectators: [],
      messages: [],
      announcement: '🍿 Bem-vindos à sessão de Cinema Ultra 4K!',
      isLocked: false,
      adminOnlyControl: true,
    };

    // Add user
    if (!room.spectators.some((s) => s.id === user.id)) {
      room.spectators.push(user);
    }

    const joinMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      userId: 'system',
      userName: 'Cinema',
      avatar: '🎟️',
      text: `${user.name} ocupou a Poltrona ${assignedSeat + 1}! (${room.spectators.length}/5)`,
      timestamp: Date.now(),
      isSystem: true,
    };
    room.messages.push(joinMsg);

    this.currentUser = user;
    this.currentRoomState = room;

    try {
      localStorage.setItem(`cineroom_${this.normalizedRoomId}_pwd`, passwordAttempt);
      localStorage.setItem(`cineroom_${this.normalizedRoomId}_state`, JSON.stringify(room));
    } catch (e) {}

    this.broadcastMessage({
      type: 'SPECTATOR_JOINED',
      spectator: user,
      message: joinMsg,
      spectatorCount: room.spectators.length,
      roomState: room,
    });

    this.initPeerAsClient();

    return { user, room };
  }

  // WebRTC Host initialization
  private initPeerAsHost() {
    try {
      const hostPeerId = `cineroom_host_${this.normalizedRoomId}`;
      if (this.peer) this.peer.destroy();

      this.peer = new Peer(hostPeerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('connection', (conn) => {
        conn.on('open', () => {
          this.connections.set(conn.peer, conn);
          // Send current state to newly connected peer
          if (this.currentRoomState) {
            conn.send({
              type: 'ROOM_JOINED',
              roomState: this.currentRoomState,
            });
          }
        });

        conn.on('data', (data: any) => {
          this.handleIncomingMessage(data);
          // Forward to all other peers
          this.broadcastToPeers(data, conn.peer);
        });

        conn.on('close', () => {
          this.connections.delete(conn.peer);
        });
      });
    } catch (e) {
      console.warn('WebRTC Host initialization skipped:', e);
    }
  }

  // WebRTC Client initialization
  private initPeerAsClient() {
    try {
      const clientPeerId = `cineroom_client_${this.normalizedRoomId}_${Math.random().toString(36).substring(2, 7)}`;
      if (this.peer) this.peer.destroy();

      this.peer = new Peer(clientPeerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', () => {
        const hostPeerId = `cineroom_host_${this.normalizedRoomId}`;
        const conn = this.peer!.connect(hostPeerId, { reliable: true });

        conn.on('open', () => {
          this.hostConnection = conn;
          if (this.currentUser) {
            conn.send({
              type: 'SPECTATOR_JOINED',
              spectator: this.currentUser,
            });
          }
        });

        conn.on('data', (data: any) => {
          this.handleIncomingMessage(data);
        });
      });
    } catch (e) {
      console.warn('WebRTC Client connection skipped:', e);
    }
  }

  public broadcastMessage(message: SyncMessage) {
    // 1. BroadcastChannel (same browser / multiple tabs)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch (e) {}
    }

    // 2. WebRTC DataConnections (cross-device/network)
    this.broadcastToPeers(message);

    // 3. Local update
    this.handleIncomingMessage(message);
  }

  private broadcastToPeers(message: SyncMessage, excludePeerId?: string) {
    // If host, send to all connected clients
    this.connections.forEach((conn, peerId) => {
      if (peerId !== excludePeerId && conn.open) {
        try {
          conn.send(message);
        } catch (e) {}
      }
    });

    // If client, send to host
    if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(message);
      } catch (e) {}
    }
  }

  private handleIncomingMessage(data: SyncMessage) {
    if (this.onMessageCallback) {
      this.onMessageCallback(data);
    }
  }

  public cleanUp() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connections.clear();
    this.hostConnection = null;
    this.currentRoomState = null;
    this.currentUser = null;
  }
}

export const peerSync = new PeerSyncEngine();
