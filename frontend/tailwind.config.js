/** @type {import('tailwindcss').Config} */
// Design tokens — "space editorial" theme. Keep in sync with :root vars in src/index.css
// and with src/ui/tokens.ts (hex values used inside SVG charts).
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#06070A',           // page canvas
        fg: '#F5F5F4',            // primary text
        soft: '#D4D4D8',          // strong secondary text (long prose on cards)
        muted: '#A1A1AA',         // secondary text / labels (≥ 7:1 on ink)
        line: 'rgba(255,255,255,0.08)',        // hairline dividers
        'line-strong': 'rgba(255,255,255,0.14)',
        accent: { DEFAULT: '#FF6B2C', hover: '#FF8552', ink: '#1A0A02' }, // Mars orange (single accent)
        nominal: '#4ADE80',
        watch: '#FBBF24',
        act: '#F43F5E',
        real: '#34D399',          // real-data badge (emerald)
        series: { 1: '#199EB8', 2: '#9A7AEA' }, // chart series (validated pair, dark surface)
        // LEGACY aliases for screens not yet migrated — removed once every view uses the tokens above.
        mars: { dark: 'rgba(0,0,0,0.3)', card: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        sans: ['Inter', '"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', '"Cascadia Mono"', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        display: '-0.03em',
        label: '0.2em',
      },
      fontSize: {
        label: ['11px', { lineHeight: '16px', letterSpacing: '0.2em' }],
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'none' } },
        'act-glow': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(244,63,94,0.0), 0 0 12px 0 rgba(244,63,94,0.25)' },
          '50%': { boxShadow: '0 0 0 3px rgba(244,63,94,0.15), 0 0 22px 2px rgba(244,63,94,0.45)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 360ms cubic-bezier(.2,.7,.2,1) both',
        'act-glow': 'act-glow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
