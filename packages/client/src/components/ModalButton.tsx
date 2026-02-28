import React from 'react';

interface ModalButtonProps {
  variant: 'player' | 'confirm' | 'cancel';
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const baseClasses = 'w-full rounded-lg transition-colors';

const variantClasses: Record<ModalButtonProps['variant'], { normal: string; selected?: string; disabled?: string }> = {
  player: {
    normal: 'py-3 bg-gray-700 hover:bg-gray-600 border border-gray-500/50 text-white text-center',
    selected: 'py-3 bg-gray-600 border border-amber-400 text-white text-center',
  },
  confirm: {
    normal: 'py-3 bg-amber-400/90 hover:bg-amber-400 text-gray-900 font-semibold',
    disabled: 'py-3 bg-amber-400/90 text-gray-900 font-semibold opacity-50 cursor-not-allowed',
  },
  cancel: {
    normal: 'py-2 bg-transparent hover:bg-gray-700/50 text-gray-400',
  },
};

export function ModalButton({ variant, selected, disabled, onClick, children }: ModalButtonProps) {
  const styles = variantClasses[variant];
  let classes: string;

  if (disabled && styles.disabled) {
    classes = `${baseClasses} ${styles.disabled}`;
  } else if (selected && styles.selected) {
    classes = `${baseClasses} ${styles.selected}`;
  } else {
    classes = `${baseClasses} ${styles.normal}`;
  }

  return (
    <button
      className={classes}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
