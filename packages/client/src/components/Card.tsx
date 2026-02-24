import React from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType } from '@shit-head-palace/engine';

// ─── Constantes visuelles ──────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CardProps {
  card: CardType;
  /** Affiche le dos de la carte (cache rang/couleur) */
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
  /** Désactive le hover et le click */
  disabled?: boolean;
  size?: 'sm' | 'md';
  /** Disable layoutId animation (prevents cross-phase layout conflicts) */
  noLayout?: boolean;
}

// ─── Dos de carte ──────────────────────────────────────────────────────────────

function CardBack({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'w-11 h-16' : 'w-14 h-20';
  return (
    <div
      className={`${dims} rounded-lg border-2 border-blue-900 bg-gradient-to-br from-blue-800 to-blue-950 shadow-md flex items-center justify-center`}
    >
      <div className="w-[85%] h-[85%] rounded border border-blue-600 flex items-center justify-center">
        <span className="text-gold text-base select-none">✦</span>
      </div>
    </div>
  );
}

// ─── Face de carte ─────────────────────────────────────────────────────────────

function CardFace({ card, size = 'md' }: { card: CardType; size?: 'sm' | 'md' }) {
  const isRed = RED_SUITS.has(card.suit);
  const color = isRed ? 'text-red-600' : 'text-gray-900';
  const symbol = SUIT_SYMBOL[card.suit] ?? '?';
  const dims = size === 'sm' ? 'w-11 h-16 text-xs' : 'w-14 h-20 text-sm';

  return (
    <div
      className={`${dims} rounded-lg border-2 border-gray-200 bg-white shadow-md relative select-none`}
    >
      {/* Coin haut-gauche */}
      <div className={`absolute top-0.5 left-1 leading-none font-bold ${color}`}>
        <div className="text-xs">{card.rank}</div>
        <div className="text-xs">{symbol}</div>
      </div>

      {/* Symbole central */}
      <div
        className={`absolute inset-0 flex items-center justify-center font-bold ${color}`}
        style={{ fontSize: size === 'sm' ? '1.2rem' : '1.5rem' }}
      >
        {symbol}
      </div>

      {/* Coin bas-droit (inversé) */}
      <div
        className={`absolute bottom-0.5 right-1 leading-none font-bold rotate-180 ${color}`}
      >
        <div className="text-xs">{card.rank}</div>
        <div className="text-xs">{symbol}</div>
      </div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

export function Card({ card, faceDown, selected, onClick, disabled, size = 'md', noLayout }: CardProps) {
  const isHidden = faceDown || card.hidden;
  const isClickable = !!onClick && !disabled;

  const borderClass = selected
    ? 'border-2 border-gold'
    : 'border-2 border-transparent';

  return (
    <motion.div
      layoutId={noLayout || isHidden ? undefined : card.id}
      className={`relative rounded-lg ${borderClass} ${isClickable ? 'cursor-pointer' : 'cursor-default'} ${disabled ? 'opacity-60' : ''}`}
      style={{
        zIndex: selected ? 10 : 'auto',
        boxShadow: selected ? '0 0 12px rgba(201, 168, 76, 0.6)' : 'none',
      }}
      animate={{ y: selected ? -18 : 0 }}
      whileHover={isClickable && !selected ? { y: -10, scale: 1.04 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={isClickable ? onClick : undefined}
    >
      {isHidden ? <CardBack size={size} /> : <CardFace card={card} size={size} />}
    </motion.div>
  );
}

export default Card;
