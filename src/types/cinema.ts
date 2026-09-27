export type QualityPreset =
  | 'original'
  | 'ultra_4k'
  | 'hdr_vibrant'
  | 'crisp_sharp'
  | 'cyberpunk'
  | 'night_mode';

export interface Spectator {
  id: string;
  name: string;
  avatar: string;
  seatIndex: number;
  isAdmin: boolean;
  isMuted?: boolean;
  ping?: number;
  joinedAt?: number;
}

export interface VideoState {
  url: string;
  title: string;
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number;
  playbackRate: number;
  duration: number;
  qualityPreset: QualityPreset;
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

export interface CinemaRoomState {
  roomId: string;
  ipPort: string; // alias
  roomName: string;
  maxUsers: number;
  adminId: string;
  adminName: string;
  videoState: VideoState;
  spectators: Spectator[];
  messages: ChatMessage[];
  announcement: string | null;
  isLocked: boolean;
  adminOnlyControl: boolean;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  userName: string;
  userId: string;
  seatIndex: number;
  x: number;
  timestamp: number;
}
