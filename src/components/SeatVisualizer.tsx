import React from 'react';
import { Spectator } from '../types/cinema';
import { Crown, Wifi } from 'lucide-react';

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
    <div className="bg-slate-900/90 border border-blue-900/40 backdrop-blur-md rounded-2xl p-4 shadow-xl shadow-blue-950/30">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-950">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
            Poltronas VIP ({spectators.length}/{maxSeats})
          </h3>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-cyan-300 border border-blue-500/30">
          Capacidade: {maxSeats} pessoas
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
                    ? 'bg-gradient-to-b from-blue-950/70 to-indigo-950/70 border-cyan-400/60 shadow-lg shadow-blue-950/60'
                    : 'bg-slate-950 border-blue-950'
                  : 'bg-slate-950/40 border-dashed border-slate-800 hover:border-blue-900'
              }`}
            >
              {occupant?.isAdmin && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-cyan-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-0.5">
                  <Crown className="w-2.5 h-2.5 fill-current" />
                  <span>HOST</span>
                </div>
              )}

              <div
                className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-xl md:text-2xl mt-1 mb-1.5 transition-transform group-hover:scale-105 ${
                  isOccupied
                    ? isMe
                      ? 'bg-gradient-to-br from-blue-600 to-cyan-500 ring-2 ring-cyan-300 shadow-inner'
                      : 'bg-blue-950/60 text-white'
                    : 'bg-slate-900/60 text-slate-600'
                }`}
              >
                {isOccupied ? (
                  <span>{occupant?.avatar || '🍿'}</span>
                ) : (
                  <span className="text-xs font-mono font-bold text-slate-600">P{seatNumber}</span>
                )}
              </div>

              <div className="w-full">
                <p
                  className={`text-[11px] md:text-xs font-semibold truncate ${
                    isOccupied
                      ? isMe
                        ? 'text-cyan-300 font-bold'
                        : 'text-slate-200'
                      : 'text-slate-500 italic'
                  }`}
                >
                  {isOccupied ? (isMe ? `${occupant?.name} (Você)` : occupant?.name) : 'Livre'}
                </p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className="text-[9px] font-mono text-slate-400">Poltrona {seatNumber}</span>
                  {occupant && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" title="Online" />
                  )}
                </div>
              </div>

              {isOccupied && (
                <div className="mt-1 flex items-center gap-1 text-[9px] font-mono text-cyan-300/80">
                  <Wifi className="w-2.5 h-2.5 text-cyan-400" />
                  <span>{occupant?.ping || 18}ms</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
