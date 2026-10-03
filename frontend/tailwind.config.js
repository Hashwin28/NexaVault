/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#080C0E',         // Very dark charcoal background
          canvas: '#0B0F12',     // Subtly lighter canvas background
          surface: '#11181C',    // Card/Container surface
          elevated: '#162026',   // Input / button background
          border: '#1B262E',     // Neutral border
          'border-teal': 'rgba(20, 184, 166, 0.22)', // Subtle teal border
          muted: '#81939E',      // Muted neutral text
          heading: '#ECF1F4',    // Primary text
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
