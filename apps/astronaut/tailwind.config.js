/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Same palette as frontend/ so both apps look like one product
      colors: {
        mars: {
          dark: '#080c14',
          card: '#0e1626',
          border: '#1f2e4d',
          accent: '#e65c00',
          cyan: '#06b6d4',
          green: '#10b981',
          gold: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
}
