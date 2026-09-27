import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Spectator } from '../types/cinema';
import { Send, MessageSquare } from 'lucide-react';

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
    <div className="bg-slate-900/90 border border-blue-900/40 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-blue-950">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Bate-papo da Sala
            </h3>
            <p className="text-[10px] text-cyan-300/80">Mensagens em tempo real</p>
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
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs scrollbar-thin scrollbar-thumb-blue-900">
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
                  className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-2 text-center text-[11px] text-cyan-300 font-medium"
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
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-md shadow-blue-950/50'
                      : 'bg-slate-950 text-slate-100 rounded-tl-none border border-blue-950'
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
      <div className="pt-2 border-t border-blue-950 flex items-center justify-around py-1.5">
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
          className="flex-1 bg-slate-950 border border-blue-950 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
        />
        <button
          type="submit"
          className="p-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl shadow-lg shadow-blue-950 transition-all active:scale-95 flex items-center justify-center border border-cyan-400/30"
          title="Enviar"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
