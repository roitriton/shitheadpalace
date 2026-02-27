import { AnimatePresence, motion } from 'framer-motion';
import type { GamePhase } from '@shit-head-palace/engine';

interface RevolutionBannerProps {
  phase: GamePhase;
}

export function RevolutionBanner({ phase }: RevolutionBannerProps) {
  const isRevolution = phase === 'revolution';
  const isSuperRevolution = phase === 'superRevolution';
  const visible = isRevolution || isSuperRevolution;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="px-3 py-1.5 rounded-lg text-center"
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-sm">
              {isSuperRevolution ? '\u2666\uFE0F\u26A1' : '\u2666\uFE0F'}
            </span>
            <span className="font-serif font-bold text-xs text-gray-100 tracking-wide uppercase">
              {isSuperRevolution ? 'Super R\u00e9volution' : 'R\u00e9volution'}
            </span>
          </div>
          <p className="text-[9px] text-gray-400 leading-tight mt-0.5">
            {isSuperRevolution
              ? 'Valeurs invers\u00e9es + pouvoirs off (permanent)'
              : 'Valeurs invers\u00e9es + pouvoirs off'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
