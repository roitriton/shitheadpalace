import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ModalWrapper } from './ModalWrapper';
import type { PendingShifumiResult, ShifumiChoice } from '@shit-head-palace/engine';

const CHOICE_DISPLAY: Record<ShifumiChoice, { emoji: string; label: string }> = {
  rock: { emoji: '🪨', label: 'Pierre' },
  paper: { emoji: '📄', label: 'Papier' },
  scissors: { emoji: '✂️', label: 'Ciseaux' },
};

const SHIFUMI_RESULT_DURATION = 3000;

interface ShifumiResultModalProps {
  pending: PendingShifumiResult;
}

export function ShifumiResultModal({ pending }: ShifumiResultModalProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / SHIFUMI_RESULT_DURATION, 1));
      if (elapsed >= SHIFUMI_RESULT_DURATION) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const {
    player1Name, player1Choice,
    player2Name, player2Choice,
    result, shifumiType,
  } = pending;

  const c1 = CHOICE_DISPLAY[player1Choice];
  const c2 = CHOICE_DISPLAY[player2Choice];

  // Title
  let title = 'Shifumi ♣';
  if (shifumiType === 'super') title = 'Super Shifumi ♣';
  else if (shifumiType === 'firstPlayer') title = 'Premier joueur';

  // Winner/loser names
  const winnerName = result === 'player1' ? player1Name : result === 'player2' ? player2Name : null;
  const loserName = result === 'player1' ? player2Name : result === 'player2' ? player1Name : null;

  // Result text
  let resultText: string;
  if (result === 'tie') {
    resultText = 'Égalité !';
  } else {
    resultText = `${winnerName} gagne !`;
  }

  // Effect text
  let effectText: string;
  if (result === 'tie') {
    effectText = `${player1Name} et ${player2Name} vont rejouer`;
  } else if (shifumiType === 'super') {
    effectText = `${loserName} est le Shit Head`;
  } else if (shifumiType === 'firstPlayer') {
    effectText = `${winnerName} commence la partie`;
  } else {
    effectText = `${loserName} ramasse la pile`;
  }

  return (
    <ModalWrapper title={title}>
      {/* Choices display */}
      <div className="flex items-center justify-center gap-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl">{c1.emoji}</span>
          <span className="text-sm text-gray-200 font-semibold">{player1Name}</span>
          <span className="text-xs text-gray-400">{c1.label}</span>
        </div>
        <span className="text-gray-500 text-lg font-bold">vs</span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl">{c2.emoji}</span>
          <span className="text-sm text-gray-200 font-semibold">{player2Name}</span>
          <span className="text-xs text-gray-400">{c2.label}</span>
        </div>
      </div>

      {/* Result */}
      <p className="text-center text-lg font-bold text-amber-400 mt-4">
        {resultText}
      </p>

      {/* Effect */}
      <p className="text-center text-sm text-gray-300 mt-1">
        {effectText}
      </p>

      {/* Progress bar */}
      <div className="mt-4 h-1 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-amber-400/60 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.05 }}
        />
      </div>
    </ModalWrapper>
  );
}
