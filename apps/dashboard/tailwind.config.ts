import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#071120', 900: '#0a1628', 800: '#10203a', 700: '#1a3050' },
        slate: {
          500: '#5b6472',
          400: '#8a94a6',
          300: '#cbd5e1',
          200: '#dce3ec',
          100: '#eef3f7',
          50: '#f6f8fb',
        },
        teal: { brand: '#00b89a', soft: '#e5faf5', 700: '#009d82', 300: '#6ee7c8' },
        surface: { DEFAULT: '#ffffff', muted: '#eef3f7', subtle: '#f6f8fb' },
        border: { DEFAULT: '#dce3ec' },
        canvas: '#f6f8fb',
        cyan: { 600: '#0891b2' },
        warning: { DEFAULT: '#b45309', soft: '#fff6e5' },
        danger: { DEFAULT: '#b42318', soft: '#fff0ee' },
        info: { DEFAULT: '#1d4ed8', soft: '#eaf1ff' },
      },
      fontFamily: {
        display: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem',
        'card-lg': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(10 22 40 / 0.04), 0 8px 24px rgb(10 22 40 / 0.04)',
      },
      spacing: {
        gutter: '24px',
        'gutter-sm': '16px',
      },
      keyframes: {
        dashIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        dashIn: 'dashIn 240ms ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
