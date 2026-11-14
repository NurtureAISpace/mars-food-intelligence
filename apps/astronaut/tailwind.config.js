/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Same glass/indigo look as frontend/ so both apps look like one product
      colors: {
        mars: {
          dark: '#020617',                         // inputs / wells
          card: 'rgb(15 23 42 / <alpha-value>)',    // section cards (used as bg-mars-card/55 + blur)
          border: 'rgba(96, 165, 250, 0.25)',       // section card border
          accent: '#4f46e5',                        // indigo (single accent)
          cyan: '#06b6d4',
          green: '#10b981',
          gold: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', '"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
