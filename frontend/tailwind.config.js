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
          dark: '#080c14',
          card: '#0e1626',
          border: '#1f2e4d',
          accent: '#e65c00',
          red: '#f97316',
          cyan: '#06b6d4',
          green: '#10b981',
          gold: '#f59e0b'
        }
      }
    },
  },
  plugins: [],
}
