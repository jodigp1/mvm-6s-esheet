import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        // Design tokens dari project lama — tinggal pakai bg-brand, text-brand, dll
        brand: {
          DEFAULT: '#7C6EF5',
          light:   '#9F95F7',
          pale:    '#F0EEFF',
          dark:    '#5A4FBF',
        },
        success: {
          DEFAULT: '#10C98F',
          light:   '#E6FFF6',
        },
        warning: {
          DEFAULT: '#FF8F5C',
          light:   '#FFF2EB',
        },
        danger: {
          DEFAULT: '#FF5C7A',
          light:   '#FFE8ED',
        },
        yellow: {
          DEFAULT: '#FACC15',
          light:   '#FEFCE8',
        },
        ink: {
          DEFAULT: '#16162A',
          2:       '#4B5169',
          3:       '#9CA3AF',
        },
        surface: {
          DEFAULT: '#F4F3FF',
          card:    '#FFFFFF',
          border:  '#E8E6FF',
        },
        // Kategori audit
        ex: { DEFAULT: '#10C98F', light: '#E6FFF6' },  // Excellent
        sd: { DEFAULT: '#FACC15', light: '#FEFCE8' },  // Standard
        ni: { DEFAULT: '#FF5C7A', light: '#FFE8ED' },  // Need Improvement
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      boxShadow: {
        card:  '0 2px 12px rgba(124,110,245,.10), 0 1px 4px rgba(124,110,245,.07)',
        'card-hover': '0 6px 24px rgba(124,110,245,.16), 0 2px 8px rgba(124,110,245,.10)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #7C6EF5, #9F95F7)',
        'gradient-page':  'radial-gradient(ellipse 70% 50% at 10% -10%, rgba(124,110,245,.12) 0%, transparent 60%)',
      },
    },
  },
  plugins: [],
}

export default config
