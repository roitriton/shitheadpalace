/** A unified theme combining table background and card back. */
export interface Theme {
  id: string;
  label: string;
  bgImage: string;
  bgColor: string;
  cardBackImage: string;
}

export const THEMES: Theme[] = [
  { id: 'casino', label: 'Casino', bgImage: '/themes/casino-bg.webp', bgColor: '#2d6b3f', cardBackImage: '/themes/casino-back.webp' },
  { id: 'saloon', label: 'Saloon', bgImage: '/themes/saloon-bg.webp', bgColor: '#2a2220', cardBackImage: '/themes/saloon-back.webp' },
  { id: 'pirate', label: 'Pirate', bgImage: '/themes/pirate-bg.webp', bgColor: '#d4c5a0', cardBackImage: '/themes/pirate-back.webp' },
  { id: 'love', label: 'Love', bgImage: '/themes/love-bg.webp', bgColor: '#7b5a8e', cardBackImage: '/themes/love-back.webp' },
  { id: 'foot', label: 'Foot', bgImage: '/themes/foot-bg.webp', bgColor: '#2e7d32', cardBackImage: '/themes/foot-back.webp' },
];

export const DEFAULT_THEME = THEMES[0]!;
