/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: 'var(--color-vault-bg)',
          canvas: 'var(--color-vault-canvas)',
          surface: 'var(--color-vault-surface)',
          elevated: 'var(--color-vault-elevated)',
          border: 'var(--color-vault-border)',
          'border-teal': 'var(--color-vault-border-teal)',
          muted: 'var(--color-vault-muted)',
          heading: 'var(--color-vault-heading)',
          text: 'var(--color-vault-text)',
        },
        teal: {
          950: '#041C1A',
          900: '#082F2C',
          800: '#0D4844',
          700: '#115E59',
          600: '#0D9488',
          500: '#14B8A6',
          400: '#2DD4BF',
          300: '#5EEAD4',
          200: '#99F6E4',
          100: '#CCFBF1',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'teal-glow': '0 0 25px -5px rgba(20, 184, 166, 0.15)',
        'teal-focus': '0 0 0 3px rgba(20, 184, 166, 0.25)',
        'card-subtle': '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
      },
      backgroundImage: {
        'grid-pattern': "radial-gradient(circle at 1px 1px, rgba(20, 184, 166, 0.12) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};
