import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { AuthProvider } from './auth/authContext';
import { ThemeProvider } from './themes/ThemeContext';

describe('App', () => {
  it('renders the game title', () => {
    render(
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>,
    );
    expect(screen.getByText('Shit Head Palace')).toBeInTheDocument();
  });
});
