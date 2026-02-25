/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          dark: '#1a472a',
          light: '#2d8a4e',
        },
        gold: '#c9a84c',
        casino: {
          room: '#0a0a0f',
          wood: '#3d2b1f',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
