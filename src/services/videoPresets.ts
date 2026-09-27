export interface VideoPreset {
  id: string;
  title: string;
  category: 'Cinema 4K' | 'Trailer Sci-Fi' | 'Animação 4K' | 'Natureza & Relax' | 'Cyberpunk' | 'Transmissão Ao Vivo (HLS)';
  url: string;
  thumbnail: string;
  duration: number;
  format: 'html5' | 'hls' | 'youtube';
  qualityTag: '4K Ultra HD' | '1080p 60FPS' | 'HDR Cinema' | 'Dolby Vision Demo';
  description: string;
}

export const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: 'big-buck-bunny-4k',
    title: 'Big Buck Bunny (4K Ultra HD 60fps)',
    category: 'Animação 4K',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    duration: 596,
    format: 'html5',
    qualityTag: '4K Ultra HD',
    description: 'Animação aberta renderizada em alta fidelidade com cores vibrantes e nitidez extrema.',
  },
  {
    id: 'tears-of-steel-4k',
    title: 'Tears of Steel (Sci-Fi 4K HDR FX)',
    category: 'Trailer Sci-Fi',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    duration: 734,
    format: 'html5',
    qualityTag: 'HDR Cinema',
    description: 'Ficção científica com efeitos visuais pesados, iluminação volumétrica e contraste dinâmico.',
  },
  {
    id: 'elephants-dream',
    title: 'Elephants Dream (Cinema 4K Clássico)',
    category: 'Cinema 4K',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
    duration: 653,
    format: 'html5',
    qualityTag: '4K Ultra HD',
    description: 'Jornada surreal através de uma colossal máquina computacional futurista.',
  },
  {
    id: 'sintel-fantasy-4k',
    title: 'Sintel - A Jornada do Dragão (4K HDR)',
    category: 'Animação 4K',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
    duration: 888,
    format: 'html5',
    qualityTag: 'HDR Cinema',
    description: 'Obra cinematográfica premiada com detalhes em pele, escamas de dragão e partículas de neve.',
  },
  {
    id: 'hls-bbb-test',
    title: 'Transmissão Adaptativa HLS Live Stream',
    category: 'Transmissão Ao Vivo (HLS)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
    duration: 634,
    format: 'hls',
    qualityTag: '4K Ultra HD',
    description: 'Transmissão adaptativa em protocolo HLS (.m3u8) com múltiplas taxas de bits sincronizadas.',
  },
];

export function detectMediaFormat(url: string): 'html5' | 'hls' | 'youtube' {
  if (!url) return 'html5';
  const clean = url.trim().toLowerCase();
  if (clean.includes('.m3u8')) return 'hls';
  // GoogleVideo / direct CDN links should always be HTML5 direct video
  if (clean.includes('googlevideo.com') || clean.includes('videoplayback') || clean.startsWith('blob:')) {
    return 'html5';
  }
  // Standard YouTube watch/embed URLs
  if (clean.includes('youtube.com/watch') || clean.includes('youtu.be/') || clean.includes('youtube.com/embed/')) {
    return 'youtube';
  }
  return 'html5';
}

export function extractYouTubeId(url: string): string | null {
  if (!url || url.includes('googlevideo.com') || url.includes('videoplayback')) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}
