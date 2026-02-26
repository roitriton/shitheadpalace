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
  size?: 'xs' | 'sm' | 'md';
  /** Disable layoutId animation (prevents cross-phase layout conflicts) */
  noLayout?: boolean;
  /** Skip built-in y-shift and hover animations (parent handles them) */
  noMotion?: boolean;
  /** Visual variant: 'burned' shows black background with colored text (graveyard) */
  variant?: 'default' | 'burned';
}

// ─── Dos de carte ──────────────────────────────────────────────────────────────

function CardBack({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' }) {
  const dims = size === 'xs' ? 'w-9 h-[52px]' : size === 'sm' ? 'w-11 h-16' : 'w-14 h-20';
  const symbolSize = size === 'xs' ? 'text-[10px]' : 'text-base';
  return (
    <div
      className={`${dims} rounded-lg border-2 border-blue-900 bg-gradient-to-br from-blue-800 to-blue-950 shadow-md flex items-center justify-center`}
    >
      <div className="w-[85%] h-[85%] rounded border border-blue-600 flex items-center justify-center">
        <span className={`text-gold ${symbolSize} select-none`}>✦</span>
      </div>
    </div>
  );
}

// ─── Face de carte ─────────────────────────────────────────────────────────────

function CardFace({ card, size = 'md', burned }: { card: CardType; size?: 'xs' | 'sm' | 'md'; burned?: boolean }) {
  const isRed = RED_SUITS.has(card.suit);
  const color = burned
    ? (isRed ? 'text-red-500' : 'text-gray-100')
    : (isRed ? 'text-red-600' : 'text-gray-900');
  const symbol = SUIT_SYMBOL[card.suit] ?? '?';
  const dims = size === 'xs' ? 'w-9 h-[52px]' : size === 'sm' ? 'w-11 h-16' : 'w-14 h-20';
  const cornerText = size === 'xs' ? 'text-[8px]' : 'text-xs';
  const centerSize = size === 'xs' ? '0.9rem' : size === 'sm' ? '1.2rem' : '1.5rem';

  const bgClass = burned
    ? 'bg-gray-950 border-gray-700'
    : 'bg-white border-gray-200';

  return (
    <div
      className={`${dims} rounded-lg border-2 ${bgClass} shadow-md relative select-none`}
    >
      {/* Coin haut-gauche */}
      <div className={`absolute top-0.5 left-0.5 leading-none font-bold ${color}`}>
        <div className={cornerText}>{card.rank}</div>
        <div className={cornerText}>{symbol}</div>
      </div>

      {/* Symbole central */}
      <div
        className={`absolute inset-0 flex items-center justify-center font-bold ${color}`}
        style={{ fontSize: centerSize }}
      >
        {symbol}
      </div>

      {/* Coin bas-droit (inversé) */}
      <div
        className={`absolute bottom-0.5 right-0.5 leading-none font-bold rotate-180 ${color}`}
      >
        <div className={cornerText}>{card.rank}</div>
        <div className={cornerText}>{symbol}</div>
      </div>
    </div>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

export function Card({ card, faceDown, selected, onClick, disabled, size = 'md', noLayout, noMotion, variant = 'default' }: CardProps) {
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
        zIndex: noMotion ? undefined : (selected ? 10 : 'auto'),
        boxShadow: selected ? '0 0 12px rgba(201, 168, 76, 0.6)' : 'none',
      }}
      animate={noMotion ? undefined : { y: selected ? -18 : 0 }}
      whileHover={noMotion ? undefined : (isClickable && !selected ? { y: -10, scale: 1.04 } : {})}
      transition={noMotion ? undefined : { type: 'spring', stiffness: 400, damping: 25 }}
      onClick={isClickable ? onClick : undefined}
    >
      {isHidden ? <CardBack size={size} /> : <CardFace card={card} size={size} burned={variant === 'burned'} />}
    </motion.div>
  );
}

export default Card;
