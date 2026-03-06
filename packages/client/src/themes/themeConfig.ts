/** A unified theme combining table background and card back. */
export interface Theme {
  id: string;
  label: string;
  bgImage: string;
  bgColor: string;
  cardBackImage: string;
}

export const THEMES: Theme[] = [
  { id: 'casino', label: 'Casino', bgImage: '/themes/casino-bg.jpg', bgColor: '#2d6b3f', cardBackImage: '/themes/casino-back.png' },
  { id: 'saloon', label: 'Saloon', bgImage: '/themes/saloon-bg.jpg', bgColor: '#2a2220', cardBackImage: '/themes/saloon-back.png' },
  { id: 'pirate', label: 'Pirate', bgImage: '/themes/pirate-bg.jpg', bgColor: '#d4c5a0', cardBackImage: '/themes/pirate-back.png' },
  { id: 'love', label: 'Love', bgImage: '/themes/love-bg.jpg', bgColor: '#7b5a8e', cardBackImage: '/themes/love-back.png' },
  { id: 'foot', label: 'Foot', bgImage: '/themes/foot-bg.jpg', bgColor: '#2e7d32', cardBackImage: '/themes/foot-back.png' },
];

export const DEFAULT_THEME = THEMES[0]!;
