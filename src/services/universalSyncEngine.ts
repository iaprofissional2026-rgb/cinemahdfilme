import mqtt, { MqttClient } from 'mqtt';
import { Spectator } from '../types/cinema';

export interface SyncPacket {
  id: string;
  senderId: string;
  senderName: string;
  roomId: string;
  type: string;
  payload: any;
  timestamp: number;
}

export type PacketHandler = (packet: SyncPacket) => void;

class UniversalSyncEngine {
  private client: MqttClient | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private currentRoomId: string = '';
  private currentIpPort: string = '';
  private packetHandler: PacketHandler | null = null;
  private heartbeatInterval: any = null;
  private currentUser: Spectator | null = null;
  private isConnected: boolean = false;
  private processedPacketIds: Set<string> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('cineroom_blue_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && this.packetHandler) {
            this.handleIncoming(event.data);
          }
        };
      } catch (e) {}
    }
  }

  public setPacketHandler(handler: PacketHandler) {
    this.packetHandler = handler;
  }

  public sanitizeRoomId(ipPort: string): string {
    return ipPort.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  public connect(ipPort: string, user: Spectator, onConnect?: () => void) {
    this.currentIpPort = ipPort;
    this.currentRoomId = this.sanitizeRoomId(ipPort);
    this.currentUser = user;

    if (this.client) {
      try {
        this.client.end(true);
      } catch (e) {}
    }

    // High reliability Global MQTT Broker for cross-device sync
    const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
    const clientId = `cine_${user.id}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      const client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2500,
      });

      client.on('connect', () => {
        this.isConnected = true;
        this.client = client;

        const topic = `cineroom/v3/${this.currentRoomId}/events`;
        client.subscribe(topic, { qos: 0 }, (err) => {
          if (!err) {
            // Announce presence immediately
            this.publish('USER_PRESENCE', {
              user: this.currentUser,
              isHeartbeat: false,
            });

            // If not admin, request latest room video state
            if (!this.currentUser?.isAdmin) {
              this.publish('REQUEST_INITIAL_STATE', {
                requesterId: user.id,
              });
            }

            if (onConnect) onConnect();
          }
        });

        // Periodic presence heartbeat
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
          if (this.currentUser && this.isConnected) {
            this.publish('USER_PRESENCE', {
              user: this.currentUser,
              isHeartbeat: true,
            });
          }
        }, 3000);
      });

      client.on('message', (_topic, message) => {
        try {
          const packet: SyncPacket = JSON.parse(message.toString());
          if (packet.roomId === this.currentRoomId) {
            // Prevent handling own packets when received back from broker
            if (packet.senderId !== this.currentUser?.id) {
              this.handleIncoming(packet);
            }
          }
        } catch (e) {}
      });

      client.on('error', () => {
        this.isConnected = false;
      });

      client.on('close', () => {
        this.isConnected = false;
      });
    } catch (e) {
      if (onConnect) onConnect();
    }
  }

  private handleIncoming(packet: SyncPacket) {
    if (this.processedPacketIds.has(packet.id)) return;
    this.processedPacketIds.add(packet.id);
    if (this.processedPacketIds.size > 200) {
      const first = this.processedPacketIds.values().next().value;
      if (first) this.processedPacketIds.delete(first);
    }

    if (this.packetHandler) {
      this.packetHandler(packet);
    }
  }

  public publish(type: string, payload: any) {
    if (!this.currentUser) return;

    const packet: SyncPacket = {
      id: `pkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: this.currentUser.id,
      senderName: this.currentUser.name,
      roomId: this.currentRoomId,
      type,
      payload,
      timestamp: Date.now(),
    };

    const dataString = JSON.stringify(packet);

    // 1. BroadcastChannel (same machine/browser tabs)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch (e) {}
    }

    // 2. Publish to MQTT for all remote devices / mobiles / notebooks
    if (this.client && this.isConnected) {
      const topic = `cineroom/v3/${this.currentRoomId}/events`;
      this.client.publish(topic, dataString, { qos: 0 });
    }

    // 3. Local handling for instant UI responsiveness
    this.handleIncoming(packet);
  }

  public disconnect() {
    if (this.currentUser && this.isConnected) {
      this.publish('USER_LEFT', {
        userId: this.currentUser.id,
        userName: this.currentUser.name,
      });
    }

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.client) {
      try {
        this.client.end(true);
      } catch (e) {}
      this.client = null;
    }

    this.isConnected = false;
    this.currentRoomId = '';
    this.currentUser = null;
    this.processedPacketIds.clear();
  }
}

export const universalSync = new UniversalSyncEngine();
