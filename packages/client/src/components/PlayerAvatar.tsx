import React from 'react';
import { motion } from 'framer-motion';

// ─── Couleurs de dégradé par index de joueur ─────────────────────────────────

const AVATAR_GRADIENTS = [
  ['#2563eb', '#1d4ed8'], // bleu
  ['#dc2626', '#b91c1c'], // rouge
  ['#16a34a', '#15803d'], // vert
  ['#ea580c', '#c2410c'], // orange
];

// ─── PlayerAvatar ────────────────────────────────────────────────────────────

interface PlayerAvatarProps {
  name: string;
  playerIndex: number;
  isActive: boolean;
  /** Avatar size: 'bot' = w-12 h-12, 'human' = w-16 h-16 */
  size?: 'bot' | 'human';
  /** Player ID for DOM targeting (used by ShifumiLoserOverlay) */
  playerId?: string;
  /** Whether this player is currently disconnected */
  isDisconnected?: boolean;
}

export function PlayerAvatar({ name, playerIndex, isActive, size = 'bot', playerId, isDisconnected }: PlayerAvatarProps) {
  const [from, to] = AVATAR_GRADIENTS[playerIndex % AVATAR_GRADIENTS.length];
  const initial = name.charAt(0).toUpperCase();

  const sizeClasses = size === 'human'
    ? 'w-16 h-16 text-xl'
    : 'w-12 h-12 text-lg';

  return (
    <div className="relative flex items-center justify-center" data-player-avatar={playerId}>
      {/* Glow animé quand c'est le tour */}
      {isActive && !isDisconnected && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 12px 4px #c9a84c`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div
        className={`${sizeClasses} rounded-full flex items-center justify-center text-white font-bold
          border-2 ${isActive && !isDisconnected ? 'border-gold' : 'border-gold/40'}
          ${isDisconnected ? 'opacity-40 grayscale' : ''}`}
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
      >
        {initial}
      </div>
      {/* Disconnect indicator */}
      {isDisconnected && (
        <div className="absolute -bottom-1 -right-1 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center border border-black/50">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-2.5 h-2.5 text-white">
            <line x1="3" y1="3" x2="13" y2="13" />
            <line x1="13" y1="3" x2="3" y2="13" />
          </svg>
        </div>
      )}
    </div>
  );
}
