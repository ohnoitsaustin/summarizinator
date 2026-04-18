import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#37353E',
          surface: '#44444E',
          mid: '#715A5A',
          accent: '#D3DAD9',
          cta: '#D3DAD9',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
