import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#5409DA',
          surface: '#4E71FF',
          mid: '#8DD8FF',
          accent: '#BBFBFF',
          cta: '#BBFBFF',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
