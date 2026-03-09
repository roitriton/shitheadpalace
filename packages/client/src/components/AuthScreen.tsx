import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../auth/authContext';
import { SiteLogo } from './SiteLogo';

type Mode = 'login' | 'register';
type PageView = 'auth' | 'privacy' | 'terms';

function PlaceholderPage({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-casino-room flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-serif text-3xl text-gold mb-4">{title}</h1>
        <p className="text-gray-400 mb-6">Page en construction</p>
        <button
          onClick={onBack}
          className="px-6 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          Retour
        </button>
      </div>
    </div>
  );
}

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [pageView, setPageView] = useState<PageView>('auth');

  // Form fields
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);

  // State
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Validation
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 8;
  const confirmValid = password === confirmPassword;
  const usernameValid = username.length >= 3 && /^[a-zA-Z0-9_-]+$/.test(username);

  const loginDisabled = submitting || !emailValid || !password;
  const registerDisabled = submitting || !emailValid || !passwordValid || !confirmValid || !usernameValid || !gdprConsent;

  if (pageView === 'privacy') {
    return <PlaceholderPage title="Politique de confidentialit&eacute;" onBack={() => setPageView('auth')} />;
  }
  if (pageView === 'terms') {
    return <PlaceholderPage title="Conditions d'utilisation" onBack={() => setPageView('auth')} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!confirmValid) {
          setError('Les mots de passe ne correspondent pas');
          setSubmitting(false);
          return;
        }
        await register(email, username, password, gdprConsent);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-casino-room flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex justify-center mb-2">
          <SiteLogo size="large" />
        </div>
        <p className="text-gray-400 text-center text-sm mb-8">
          {mode === 'login' ? 'Connexion' : 'Inscription'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs text-gray-400 mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-gray-100 text-sm focus:border-gold focus:outline-none transition-colors"
              autoComplete="email"
            />
          </div>

          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                key="username"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label htmlFor="username" className="block text-xs text-gray-400 mb-1">
                  Nom d'utilisateur
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-gray-100 text-sm focus:border-gold focus:outline-none transition-colors"
                  autoComplete="username"
                />
                {username.length > 0 && !usernameValid && (
                  <p className="text-red-400 text-xs mt-1">3 caracteres min., lettres/chiffres/tirets uniquement</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label htmlFor="password" className="block text-xs text-gray-400 mb-1">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-gray-100 text-sm focus:border-gold focus:outline-none transition-colors"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && password.length > 0 && !passwordValid && (
              <p className="text-red-400 text-xs mt-1">8 caracteres minimum</p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label htmlFor="confirmPassword" className="block text-xs text-gray-400 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-gray-100 text-sm focus:border-gold focus:outline-none transition-colors"
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && !confirmValid && (
                  <p className="text-red-400 text-xs mt-1">Les mots de passe ne correspondent pas</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                key="gdpr"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={gdprConsent}
                    onChange={(e) => setGdprConsent(e.target.checked)}
                    className="mt-0.5 accent-gold"
                  />
                  <span>
                    J'accepte la{' '}
                    <button
                      type="button"
                      onClick={() => setPageView('privacy')}
                      className="text-gold underline hover:text-gold/80"
                    >
                      politique de confidentialit&eacute;
                    </button>{' '}
                    et les{' '}
                    <button
                      type="button"
                      onClick={() => setPageView('terms')}
                      className="text-gold underline hover:text-gold/80"
                    >
                      conditions d'utilisation
                    </button>
                  </span>
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-xs text-center"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={mode === 'login' ? loginDisabled : registerDisabled}
            className="w-full py-2.5 rounded font-semibold text-sm transition-colors bg-gold text-gray-900 hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting
              ? '...'
              : mode === 'login'
                ? 'Se connecter'
                : "S'inscrire"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          {mode === 'login' ? (
            <>
              Pas encore de compte ?{' '}
              <button onClick={() => switchMode('register')} className="text-gold hover:underline">
                S'inscrire
              </button>
            </>
          ) : (
            <>
              D&eacute;j&agrave; un compte ?{' '}
              <button onClick={() => switchMode('login')} className="text-gold hover:underline">
                Se connecter
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
