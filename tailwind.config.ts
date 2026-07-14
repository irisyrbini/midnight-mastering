import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#101018',
        paper: '#ece7dc',
        ember: '#e26d45',
      },
    },
  },
  plugins: [],
} satisfies Config;
