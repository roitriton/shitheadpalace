import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  type: 'player' | 'system';
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isOpen: boolean;
  onToggle: () => void;
  onSend: (message: string) => void;
  unreadCount: number;
}

export function ChatPanel({ messages, isOpen, onToggle, onSend, unreadCount }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-4 left-4 z-50 w-12 h-12 rounded-full bg-gray-800/90 border border-[#c9a84c]/30 flex items-center justify-center hover:bg-gray-700/90 transition-colors"
      >
        <span className="text-xl" role="img" aria-label="Chat">💬</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed left-0 top-0 z-[45] w-80 h-screen bg-gray-900/95 backdrop-blur border-r border-[#c9a84c]/20 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a84c]/20">
              <h2 className="font-serif text-[#c9a84c] text-lg">Chat</h2>
              <button
                type="button"
                onClick={onToggle}
                className="text-gray-400 hover:text-gray-200 transition-colors text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.type === 'system' ? (
                    <span className="italic text-gray-500 text-sm">{msg.message}</span>
                  ) : (
                    <div className="text-sm">
                      <span className="font-bold text-[#c9a84c]/80">{msg.playerName}</span>{' '}
                      <span className="text-gray-300">{msg.message}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-[#c9a84c]/20 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={200}
                placeholder="Message..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-[#c9a84c]/50 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-[#c9a84c] text-gray-900 font-semibold px-3 py-1.5 rounded text-sm hover:bg-[#d4b65c] transition-colors"
              >
                Envoyer
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
