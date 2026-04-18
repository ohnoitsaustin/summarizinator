import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#1B3C53',
          surface: '#234C6A',
          mid: '#456882',
          accent: '#D2C1B6',
          cta: '#D2C1B6',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
