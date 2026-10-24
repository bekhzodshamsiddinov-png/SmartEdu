import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#0F2A2E', 2: '#163A3F', 3: '#1F4A50' },
        canvas: '#F4F6F5',
        line: { DEFAULT: '#E3E8E6', strong: '#CBD5D2' },
        fg: { DEFAULT: '#142422', muted: '#5E6E6B', faint: '#8C9A97' },
        brand: { DEFAULT: '#0E7C6B', strong: '#0A5F52', soft: '#E3F3EF', ring: '#7CC7B8' },
        warn: { DEFAULT: '#B8681A', soft: '#FBF0E1' },
        bad: { DEFAULT: '#C23B3B', soft: '#FBE9E7' },
        info: { DEFAULT: '#2F6FB5', soft: '#E6EFF9' },
        good: { DEFAULT: '#1E8A4C', soft: '#E4F4EA' },
      },
      borderRadius: { card: '14px', field: '10px' },
      boxShadow: {
        pop: '0 12px 32px -8px rgba(15, 42, 46, 0.18), 0 2px 6px rgba(15, 42, 46, 0.06)',
        lift: '0 1px 2px rgba(15, 42, 46, 0.05)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
};
export default config;
