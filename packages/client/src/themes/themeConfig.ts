/** A tileable table background. */
export interface TableBackground {
  id: string;
  label: string;
  image: string;
  bgColor: string;
}

/** A card back design. */
export interface CardBack {
  id: string;
  label: string;
  image: string;
}

export const TABLE_BACKGROUNDS: TableBackground[] = [
  { id: 'casino', label: 'Casino', image: '/themes/casino-bg.jpg', bgColor: '#2d6b3f' },
  { id: 'saloon', label: 'Saloon', image: '/themes/saloon-bg.jpg', bgColor: '#2a2220' },
  { id: 'pirate', label: 'Pirate', image: '/themes/pirate-bg.jpg', bgColor: '#d4c5a0' },
  { id: 'love', label: 'Love', image: '/themes/love-bg.jpg', bgColor: '#7b5a8e' },
];

export const CARD_BACKS: CardBack[] = [
  { id: 'casino', label: 'Casino', image: '/themes/casino-back.png' },
  { id: 'saloon', label: 'Saloon', image: '/themes/saloon-back.png' },
  { id: 'pirate', label: 'Pirate', image: '/themes/pirate-back.png' },
  { id: 'love', label: 'Love', image: '/themes/love-back.png' },
];

export const DEFAULT_BACKGROUND = TABLE_BACKGROUNDS[0]!;
export const DEFAULT_CARD_BACK = CARD_BACKS[0]!;
