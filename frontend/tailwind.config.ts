import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      animation: {
        shimmer: 'shimmer 5s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 50%' },
          '100%': { backgroundPosition: '-200% 50%' },
        },
      },
      colors: {
        brand: {
          bg: '#021526',
          surface: '#03346E',
          mid: '#03346E',
          light: '#6EACDA',
          accent: '#C9E8FF',
          cta: '#C9E8FF',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
