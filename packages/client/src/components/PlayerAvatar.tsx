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
}

export function PlayerAvatar({ name, playerIndex, isActive, size = 'bot' }: PlayerAvatarProps) {
  const [from, to] = AVATAR_GRADIENTS[playerIndex % AVATAR_GRADIENTS.length];
  const initial = name.charAt(0).toUpperCase();

  const sizeClasses = size === 'human'
    ? 'w-16 h-16 text-xl'
    : 'w-12 h-12 text-lg';

  return (
    <div className="relative flex items-center justify-center">
      {/* Glow animé quand c'est le tour */}
      {isActive && (
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
          border-2 ${isActive ? 'border-gold' : 'border-gold/40'}`}
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
      >
        {initial}
      </div>
    </div>
  );
}
