import React from 'react';
import { useTheme } from '../themes/ThemeContext';

interface SiteLogoProps {
  /** Compact mode for header, large for auth screen */
  size?: 'compact' | 'large';
}

export function SiteLogo({ size = 'large' }: SiteLogoProps) {
  const { theme } = useTheme();

  const isCompact = size === 'compact';
  const cardH = isCompact ? 36 : 48;
  const cardW = Math.round(cardH * 0.69);
  const titleClass = isCompact
    ? 'text-base sm:text-lg'
    : 'text-3xl sm:text-4xl';

  return (
    <div className="flex items-center gap-2 select-none">
      {/* 3 fanned card backs */}
      <div className="relative flex-shrink-0" style={{ width: cardW + 16, height: cardH + 4 }}>
        {([-15, 0, 15] as const).map((angle, i) => (
          <img
            key={i}
            src={theme.cardBackImage}
            alt=""
            draggable={false}
            className="absolute rounded shadow-md"
            style={{
              width: cardW,
              height: cardH,
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${angle}deg)`,
              transformOrigin: 'center center',
              zIndex: i,
            }}
          />
        ))}
      </div>

      {/* Title */}
      <h1 className={`font-serif font-bold tracking-wide whitespace-nowrap text-[#c9a84c] ${titleClass}`}>
        Shit Head Palace
      </h1>
    </div>
  );
}
