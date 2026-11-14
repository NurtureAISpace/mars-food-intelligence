/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mars: {
          dark: '#050811',
          void: '#03050a',
          surface: '#090e1a',
          card: '#0c1322',
          border: '#1e2d4a',
          'border-light': 'rgba(255, 255, 255, 0.12)',
          accent: '#ff6b18',
          orange: '#f97316',
          red: '#f87171',
          cyan: '#22d3ee',
          green: '#34d399',
          gold: '#fbbf24',
          purple: '#a78bfa'
        }
      }
    },
  },
  plugins: [],
}
