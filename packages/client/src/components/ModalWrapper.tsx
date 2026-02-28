import React from 'react';
import { motion } from 'framer-motion';
import { ModalButton } from './ModalButton';

interface ModalWrapperProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export function ModalWrapper({ title, subtitle, children, onClose }: ModalWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center bg-black/60 z-50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-800/95 backdrop-blur border border-gray-600/50 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
      >
        <h3 className="font-serif text-xl text-amber-400 font-bold text-center">
          {title}
        </h3>

        {subtitle && (
          <p className="text-gray-300 text-sm text-center mt-2">
            {subtitle}
          </p>
        )}

        <div className="mt-4">
          {children}
        </div>

        {onClose && (
          <div className="mt-4">
            <ModalButton variant="cancel" onClick={onClose}>
              Annuler
            </ModalButton>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
