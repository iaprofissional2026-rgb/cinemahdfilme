import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Spectator } from '../types/cinema';
import { Send, MessageSquare, Sparkles, Smile, Volume2 } from 'lucide-react';

interface CinemaChatProps {
  messages: ChatMessage[];
  currentUser: Spectator | null;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
}

export const CinemaChat: React.FC<CinemaChatProps> = ({
  messages,
  currentUser,
  onSendMessage,
  onSendReaction,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const quickReactions = ['🍿', '👏', '🔥', '😂', '😱', '❤️', '🍻'];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Bate-papo da Sala
            </h3>
            <p className="text-[10px] text-slate-400">Mensagens em tempo real</p>
          </div>
        </div>

        {/* Quick Reaction Emojis in header */}
        <div className="flex items-center gap-1">
          {quickReactions.slice(0, 4).map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="hover:scale-125 transition-transform p-1 text-base active:scale-90"
              title={`Enviar ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs scrollbar-thin scrollbar-thumb-slate-700">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
            <p className="text-2xl mb-1">🍿</p>
            <p className="font-semibold text-slate-400">Nenhuma mensagem ainda.</p>
            <p className="text-[11px] text-slate-500">Mande um oi para o cinema!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === currentUser?.id;
            const isSystem = msg.isSystem;

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-2 text-center text-[11px] text-rose-300 font-medium"
                >
                  <span className="mr-1">{msg.avatar || '🎬'}</span>
                  <span>{msg.text}</span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs">{msg.avatar}</span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {isMe ? 'Você' : msg.userName}
                  </span>
                  <span className="text-[9px] text-slate-600 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div
                  className={`px-3 py-2 rounded-2xl max-w-[85%] break-words text-xs ${
                    isMe
                      ? 'bg-rose-600 text-white rounded-tr-none shadow-md shadow-rose-950/40'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/80'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reaction Bar */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-around py-1.5">
        {quickReactions.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSendReaction(emoji)}
            className="hover:scale-130 active:scale-90 transition-transform text-lg"
            title={`Reagir com ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="mt-1 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="flex-1 bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
        />
        <button
          type="submit"
          className="p-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-950/60 transition-all active:scale-95 flex items-center justify-center"
          title="Enviar"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
