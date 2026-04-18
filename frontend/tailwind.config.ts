import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#090040',
          surface: '#1a0060',
          mid: '#471396',
          accent: '#B13BFF',
          cta: '#FFCC00',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
