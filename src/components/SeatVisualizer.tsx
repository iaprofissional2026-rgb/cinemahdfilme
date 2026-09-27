import React from 'react';
import { Spectator } from '../types/cinema';
import { Crown, User, Volume2, VolumeX, Wifi } from 'lucide-react';

interface SeatVisualizerProps {
  spectators: Spectator[];
  currentUserId?: string;
  maxSeats?: number;
  onSeatClick?: (seatIndex: number, spectator?: Spectator) => void;
}

export const SeatVisualizer: React.FC<SeatVisualizerProps> = ({
  spectators,
  currentUserId,
  maxSeats = 5,
  onSeatClick,
}) => {
  const seats = Array.from({ length: maxSeats }, (_, index) => {
    const occupant = spectators.find((s) => s.seatIndex === index);
    return {
      seatNumber: index + 1,
      occupant,
    };
  });

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-md rounded-2xl p-4 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Poltronas VIP ({spectators.length}/{maxSeats})
          </h3>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
          Limite: {maxSeats} pessoas
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2 md:gap-3">
        {seats.map(({ seatNumber, occupant }, idx) => {
          const isOccupied = Boolean(occupant);
          const isMe = occupant?.id === currentUserId;

          return (
            <div
              key={idx}
              onClick={() => onSeatClick && onSeatClick(idx, occupant)}
              className={`relative group flex flex-col items-center p-2 rounded-xl transition-all duration-300 border text-center ${
                isOccupied
                  ? isMe
                    ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-950/50'
                    : 'bg-slate-800/70 border-slate-700/60'
                  : 'bg-slate-950/40 border-dashed border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Crown for admin */}
              {occupant?.isAdmin && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5 fill-current" />
                  <span>HOST</span>
                </div>
              )}

              {/* Seat visual icon */}
              <div
                className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-xl md:text-2xl mt-1 mb-1.5 transition-transform group-hover:scale-105 ${
                  isOccupied
                    ? isMe
                      ? 'bg-gradient-to-br from-rose-500/30 to-rose-700/30 ring-2 ring-rose-500/50 shadow-inner'
                      : 'bg-slate-700/50'
                    : 'bg-slate-900/60 text-slate-600'
                }`}
              >
                {isOccupied ? (
                  <span>{occupant?.avatar || '🍿'}</span>
                ) : (
                  <span className="text-xs font-mono font-bold text-slate-600">P{seatNumber}</span>
                )}
              </div>

              {/* Spectator Name */}
              <div className="w-full">
                <p
                  className={`text-[11px] md:text-xs font-semibold truncate ${
                    isOccupied
                      ? isMe
                        ? 'text-rose-300 font-bold'
                        : 'text-slate-200'
                      : 'text-slate-500 italic'
                  }`}
                >
                  {isOccupied ? (isMe ? `${occupant?.name} (Você)` : occupant?.name) : 'Vazia'}
                </p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className="text-[9px] font-mono text-slate-400">Poltrona {seatNumber}</span>
                  {occupant && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" title="Online" />
                  )}
                </div>
              </div>

              {/* Ping / Status badge */}
              {isOccupied && (
                <div className="mt-1 flex items-center gap-1 text-[9px] font-mono text-slate-400">
                  <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                  <span>{occupant?.ping || 24}ms</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
