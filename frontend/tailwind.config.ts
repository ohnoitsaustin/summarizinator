import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#17153B',
          surface: '#2E236C',
          mid: '#433D8B',
          accent: '#C8ACD6',
          cta: '#C8ACD6',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
