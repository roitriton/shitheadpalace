import { AnimatePresence, motion } from 'framer-motion';
import type { LogEntry } from '@shit-head-palace/engine';

// ─── Suit symbols ───────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = {
  hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660',
};

const SUIT_COLOR: Record<string, string> = {
  hearts: 'text-red-400', diamonds: 'text-red-400',
  clubs: 'text-white', spades: 'text-white',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

interface BannerData {
  key: string;
  name: string;
  cardSpans: { text: string; color: string }[];
  suffix: string;
}

/** Builds the banner data from the last relevant log entry. */
function buildBanner(log: LogEntry[]): BannerData | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]!;
    const name = entry.playerName ?? '?';

    if (entry.type === 'play' || entry.type === 'darkPlay') {
      const ranks = (entry.data.ranks as string[] | undefined) ?? [];
      const suits = (entry.data.suits as string[] | undefined) ?? [];
      if (ranks.length === 0) return null;

      const cardSpans = ranks.map((rank, idx) => {
        const suit = suits[idx] ?? '';
        const symbol = SUIT_SYMBOL[suit] ?? '';
        const color = SUIT_COLOR[suit] ?? 'text-white';
        return { text: `${rank}${symbol}`, color };
      });

      return { key: entry.id, name, cardSpans, suffix: '.' };
    }

    if (entry.type === 'darkPlayFail') {
      return { key: entry.id, name, cardSpans: [], suffix: ' \u00e9choue (dark) et ramasse la pile.' };
    }

    if (entry.type === 'pickUp') {
      const count = entry.data.cardCount as number | undefined;
      return { key: entry.id, name, cardSpans: [], suffix: ` ramasse la pile${count ? ` (${count})` : ''}.` };
    }
  }

  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ActionBannerProps {
  log: LogEntry[];
  /** When true the banner is hidden (e.g. while the power overlay is visible). */
  visible?: boolean;
}

export function ActionBanner({ log, visible = true }: ActionBannerProps) {
  const banner = buildBanner(log);

  return (
    <div className="min-h-[28px]" style={{ visibility: visible && banner ? 'visible' : 'hidden' }}>
      <AnimatePresence mode="wait">
        {banner && (
          <motion.div
            key={banner.key}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="mx-auto px-3 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-center"
          >
            <span className="text-xs sm:text-sm text-gray-200">
              {banner.cardSpans.length > 0 ? (
                <>
                  {banner.name} joue{' '}
                  {banner.cardSpans.map((span, i) => (
                    <span key={i}>
                      {i > 0 && ' '}
                      <span className={`font-bold ${span.color}`}>{span.text}</span>
                    </span>
                  ))}
                  {banner.suffix}
                </>
              ) : (
                <>{banner.name}{banner.suffix}</>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
