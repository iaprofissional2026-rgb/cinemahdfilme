import mqtt, { MqttClient } from 'mqtt';
import { CinemaRoomState, Spectator, ChatMessage, QualityPreset } from '../types/cinema';

export interface SyncPacket {
  id: string;
  senderId: string;
  senderName: string;
  roomId: string; // sanitized IP:Port
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
  private isConnecting: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('cineroom_universal_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && this.packetHandler) {
            this.packetHandler(event.data);
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

    this.isConnecting = true;

    // Public ultra-fast redundant WebSocket MQTT brokers (Free, zero-config, global CDN)
    const brokerUrls = [
      'wss://broker.emqx.io:8084/mqtt',
      'wss://test.mosquitto.org:8081',
      'wss://broker.hivemq.com:8884/mqtt',
    ];

    const connectToBroker = (index: number) => {
      if (index >= brokerUrls.length) {
        console.warn('All public sync brokers failed, relying on local/tab broadcast channel.');
        this.isConnecting = false;
        this.isConnected = true;
        if (onConnect) onConnect();
        return;
      }

      const brokerUrl = brokerUrls[index];
      const clientId = `cine_${user.id}_${Math.random().toString(36).substring(2, 6)}`;

      try {
        const client = mqtt.connect(brokerUrl, {
          clientId,
          clean: true,
          connectTimeout: 4000,
          reconnectPeriod: 3000,
        });

        client.on('connect', () => {
          this.isConnected = true;
          this.isConnecting = false;
          this.client = client;

          const roomTopic = `cineroom/v2/${this.currentRoomId}/#`;
          client.subscribe(roomTopic, { qos: 0 }, (err) => {
            if (!err) {
              // Announce presence immediately
              this.publish('USER_PRESENCE', {
                user: this.currentUser,
                isHeartbeat: false,
              });

              // Request state from host if joining
              this.publish('REQUEST_INITIAL_STATE', {
                requesterId: user.id,
              });

              if (onConnect) onConnect();
            }
          });

          // Start Presence Heartbeat loop every 3.5 seconds
          if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = setInterval(() => {
            if (this.currentUser && this.isConnected) {
              this.publish('USER_PRESENCE', {
                user: this.currentUser,
                isHeartbeat: true,
              });
            }
          }, 3500);
        });

        client.on('message', (topic, message) => {
          try {
            const raw = message.toString();
            const packet: SyncPacket = JSON.parse(raw);
            // Ignore own packets unless broadcast
            if (packet.roomId === this.currentRoomId) {
              if (this.packetHandler) {
                this.packetHandler(packet);
              }
            }
          } catch (e) {
            console.error('Error decoding MQTT packet:', e);
          }
        });

        client.on('error', () => {
          client.end(true);
          connectToBroker(index + 1);
        });

        setTimeout(() => {
          if (!this.isConnected && this.isConnecting) {
            client.end(true);
            connectToBroker(index + 1);
          }
        }, 4500);
      } catch (e) {
        connectToBroker(index + 1);
      }
    };

    connectToBroker(0);
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

    // 1. Send to Local BroadcastChannel for other tabs in same browser
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch (e) {}
    }

    // 2. Publish to MQTT topic for cross-device/network peers
    if (this.client && this.isConnected) {
      const topic = `cineroom/v2/${this.currentRoomId}/events`;
      this.client.publish(topic, dataString, { qos: 0 });
    }

    // 3. Local dispatch
    if (this.packetHandler) {
      this.packetHandler(packet);
    }
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
    this.isConnecting = false;
    this.currentRoomId = '';
    this.currentUser = null;
  }
}

export const universalSync = new UniversalSyncEngine();
