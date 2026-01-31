import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-aware colors using CSS variables
        'theme-bg': {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          surface: 'var(--color-bg-surface)',
          card: 'var(--color-bg-card)',
          hover: 'var(--color-bg-hover)',
          overlay: 'var(--color-bg-overlay)',
        },
        'theme-text': {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          inverted: 'var(--color-text-inverted)',
        },
        'theme-accent': {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          muted: 'var(--color-accent-muted)',
        },
        'theme-border': {
          DEFAULT: 'var(--color-border-default)',
          hover: 'var(--color-border-hover)',
        },

        // Legacy colors (keep for backwards compatibility)
        // Base - Nero profondo
        primary: {
          DEFAULT: '#0a0a0a',
          50: '#1a1a1a',
          100: '#141414',
          200: '#0f0f0f',
          300: '#0a0a0a',
          400: '#050505',
          500: '#000000',
        },
        // Accent - Oro/Bronzo per premium feel
        gold: {
          DEFAULT: '#c9a227',
          50: '#fef9e7',
          100: '#fdf0c3',
          200: '#fbe28f',
          300: '#f7d05b',
          400: '#e6b82e',
          500: '#c9a227',
          600: '#a68520',
          700: '#836719',
          800: '#604912',
          900: '#3d2b0b',
        },
        // Bronze alternative
        bronze: {
          DEFAULT: '#8b6914',
          light: '#b5892a',
          dark: '#614a0e',
        },
        // Background variants
        surface: {
          DEFAULT: '#0a0a0a',
          raised: '#141414',
          overlay: '#1a1a1a',
          card: '#1f1f1f',
          hover: '#2a2a2a',
        },
        // Text colors
        text: {
          primary: '#ffffff',
          secondary: '#a1a1aa',
          muted: '#71717a',
          inverted: '#0a0a0a',
        },
        // Feedback colors
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        // Theme-aware heading font
        'theme-heading': ['var(--font-heading)', 'Georgia', 'serif'],
        // Legacy font families
        display: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // Display sizes for hero sections
        'display-xl': ['6rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'display-lg': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        'display-sm': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'scale-in': 'scaleIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-down': 'slideDown 0.5s ease-out forwards',
        'slide-left': 'slideLeft 0.5s ease-out forwards',
        'slide-right': 'slideRight 0.5s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201, 162, 39, 0.4)' },
          '50%': { boxShadow: '0 0 20px 10px rgba(201, 162, 39, 0.2)' },
        },
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
        '1000': '1000ms',
        '1200': '1200ms',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-expo': 'cubic-bezier(0.7, 0, 0.84, 0)',
        'in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        // Theme-aware shadows
        'theme-card': 'var(--shadow-card)',
        'theme-accent': 'var(--shadow-accent)',
        // Legacy shadows
        'gold': '0 4px 20px -2px rgba(201, 162, 39, 0.25)',
        'gold-lg': '0 10px 40px -5px rgba(201, 162, 39, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
