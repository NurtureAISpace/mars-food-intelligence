/** @type {import('tailwindcss').Config} */
// Design tokens — "glass over space photo" theme. Keep in sync with :root vars in src/index.css
// and with src/ui/tokens.ts (hex values used in inline styles / SVG on the hidden "More" screens).
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#020617',           // page canvas (behind the photo)
        fg: '#F8FAFC',            // primary text
        soft: '#E2E8F0',          // strong secondary text
        muted: '#CBD5E1',         // secondary text (slate-300; AA on the glass panel)
        line: 'rgba(148,163,184,0.18)',
        'line-strong': 'rgba(148,163,184,0.3)',
        accent: { DEFAULT: '#6366F1', hover: '#818CF8', ink: '#1E1B4B' }, // indigo (single accent)
        nominal: '#4ADE80',       // "All good"
        watch: '#FBBF24',         // "Take care"
        act: '#F43F5E',           // "Call doctor"
        real: '#34D399',          // real-data tag (emerald)
        series: { 1: '#3B82F6', 2: '#A78BFA' },
      },
      fontFamily: {
        display: ['Inter', '"Segoe UI"', 'system-ui', 'sans-serif'],
        sans: ['Inter', '"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', '"Cascadia Mono"', 'Consolas', 'monospace'],
      },
      fontSize: {
        label: ['13px', { lineHeight: '18px', letterSpacing: '0.08em' }],
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up 320ms cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [],
}
