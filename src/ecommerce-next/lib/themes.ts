import type { ColorMode, LayoutTheme } from '@/stores/themeStore';

// Theme color definitions for each layout + color mode combination
export interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgSurface: string;
  bgCard: string;
  bgHover: string;
  bgOverlay: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverted: string;

  // Accent
  accent: string;
  accentHover: string;
  accentMuted: string;

  // Borders
  borderDefault: string;
  borderHover: string;

  // Shadows (as CSS value)
  shadowCard: string;
  shadowAccent: string;
}

// Font configuration per layout
export interface ThemeFonts {
  heading: string;
  body: string;
  headingWeight: string;
}

type ThemeDefinition = {
  dark: ThemeColors;
  light: ThemeColors;
  fonts: ThemeFonts;
};

export const themes: Record<LayoutTheme, ThemeDefinition> = {
  // DEFAULT - Luxury gold aesthetic
  default: {
    dark: {
      bgPrimary: '#0a0a0a',
      bgSecondary: '#0f0f0f',
      bgSurface: '#141414',
      bgCard: '#1f1f1f',
      bgHover: '#2a2a2a',
      bgOverlay: '#1a1a1a',
      textPrimary: '#ffffff',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      textInverted: '#0a0a0a',
      accent: '#c9a227',
      accentHover: '#d4b23a',
      accentMuted: 'rgba(201, 162, 39, 0.3)',
      borderDefault: 'rgba(255, 255, 255, 0.1)',
      borderHover: 'rgba(255, 255, 255, 0.2)',
      shadowCard: '0 4px 20px rgba(0, 0, 0, 0.4)',
      shadowAccent: '0 4px 20px -2px rgba(201, 162, 39, 0.25)',
    },
    light: {
      bgPrimary: '#fafafa',
      bgSecondary: '#f5f5f5',
      bgSurface: '#ffffff',
      bgCard: '#ffffff',
      bgHover: '#f0f0f0',
      bgOverlay: '#ffffff',
      textPrimary: '#1a1a1a',
      textSecondary: '#525252',
      textMuted: '#737373',
      textInverted: '#ffffff',
      accent: '#b8960f',
      accentHover: '#a08400',
      accentMuted: 'rgba(184, 150, 15, 0.2)',
      borderDefault: 'rgba(0, 0, 0, 0.1)',
      borderHover: 'rgba(0, 0, 0, 0.2)',
      shadowCard: '0 4px 20px rgba(0, 0, 0, 0.08)',
      shadowAccent: '0 4px 20px -2px rgba(184, 150, 15, 0.2)',
    },
    fonts: {
      heading: "'Cormorant Garamond', serif",
      body: "'Inter', sans-serif",
      headingWeight: '600',
    },
  },

  // BIOSCIENCE - Clean minimal with deep green
  bioscience: {
    dark: {
      bgPrimary: '#0f1514',
      bgSecondary: '#141a19',
      bgSurface: '#1a2120',
      bgCard: '#1e2726',
      bgHover: '#252e2d',
      bgOverlay: '#1a2120',
      textPrimary: '#e8ebe8',
      textSecondary: '#a3aba8',
      textMuted: '#6b7c78',
      textInverted: '#0f1514',
      accent: '#6b9b9c',
      accentHover: '#7fb0b1',
      accentMuted: 'rgba(107, 155, 156, 0.3)',
      borderDefault: 'rgba(255, 255, 255, 0.08)',
      borderHover: 'rgba(255, 255, 255, 0.15)',
      shadowCard: '0 4px 20px rgba(0, 0, 0, 0.3)',
      shadowAccent: '0 4px 20px -2px rgba(107, 155, 156, 0.2)',
    },
    light: {
      bgPrimary: '#f7f5f2',
      bgSecondary: '#f0ede8',
      bgSurface: '#ffffff',
      bgCard: '#ffffff',
      bgHover: '#ebe8e3',
      bgOverlay: '#ffffff',
      textPrimary: '#222f30',
      textSecondary: '#4a5556',
      textMuted: '#6b7c7d',
      textInverted: '#ffffff',
      accent: '#445e5f',
      accentHover: '#3a5152',
      accentMuted: 'rgba(68, 94, 95, 0.15)',
      borderDefault: 'rgba(34, 47, 48, 0.1)',
      borderHover: 'rgba(34, 47, 48, 0.2)',
      shadowCard: '0 4px 20px rgba(34, 47, 48, 0.08)',
      shadowAccent: '0 4px 20px -2px rgba(68, 94, 95, 0.15)',
    },
    fonts: {
      heading: "'Manrope', sans-serif",
      body: "'Inter', sans-serif",
      headingWeight: '400',
    },
  },

  // HERITAGE - Warm earth tones with terracotta
  heritage: {
    dark: {
      bgPrimary: '#1a1614',
      bgSecondary: '#1f1b18',
      bgSurface: '#262220',
      bgCard: '#2c2724',
      bgHover: '#332e2a',
      bgOverlay: '#262220',
      textPrimary: '#f0ebe8',
      textSecondary: '#b8aea6',
      textMuted: '#8a7d74',
      textInverted: '#1a1614',
      accent: '#d4693d',
      accentHover: '#e07a4e',
      accentMuted: 'rgba(212, 105, 61, 0.3)',
      borderDefault: 'rgba(255, 255, 255, 0.08)',
      borderHover: 'rgba(255, 255, 255, 0.15)',
      shadowCard: '0 4px 20px rgba(0, 0, 0, 0.3)',
      shadowAccent: '0 4px 20px -2px rgba(212, 105, 61, 0.25)',
    },
    light: {
      bgPrimary: '#ebf0eb',
      bgSecondary: '#e3e8e3',
      bgSurface: '#ffffff',
      bgCard: '#ffffff',
      bgHover: '#dce2dc',
      bgOverlay: '#ffffff',
      textPrimary: '#121212',
      textSecondary: '#4a4540',
      textMuted: '#8a6d5e',
      textInverted: '#ffffff',
      accent: '#ad4b1a',
      accentHover: '#964012',
      accentMuted: 'rgba(173, 75, 26, 0.15)',
      borderDefault: 'rgba(18, 18, 18, 0.1)',
      borderHover: 'rgba(18, 18, 18, 0.2)',
      shadowCard: '0 4px 20px rgba(18, 18, 18, 0.08)',
      shadowAccent: '0 4px 20px -2px rgba(173, 75, 26, 0.2)',
    },
    fonts: {
      heading: "'DM Sans', sans-serif",
      body: "'Inter', sans-serif",
      headingWeight: '500',
    },
  },

  // COSMOS - Tech premium with teal/cyan
  cosmos: {
    dark: {
      bgPrimary: '#0a1020',
      bgSecondary: '#0e1428',
      bgSurface: '#121830',
      bgCard: '#181e38',
      bgHover: '#1e2540',
      bgOverlay: '#121830',
      textPrimary: '#e2e8f0',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      textInverted: '#0a1020',
      accent: '#22c8ff',
      accentHover: '#4dd4ff',
      accentMuted: 'rgba(34, 200, 255, 0.3)',
      borderDefault: 'rgba(255, 255, 255, 0.08)',
      borderHover: 'rgba(255, 255, 255, 0.15)',
      shadowCard: '0 4px 20px rgba(0, 0, 0, 0.4)',
      shadowAccent: '0 4px 20px -2px rgba(34, 200, 255, 0.25)',
    },
    light: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f8fafc',
      bgSurface: '#ffffff',
      bgCard: '#ffffff',
      bgHover: '#f1f5f9',
      bgOverlay: '#ffffff',
      textPrimary: '#1e293b',
      textSecondary: '#475569',
      textMuted: '#64748b',
      textInverted: '#ffffff',
      accent: '#00a6e2',
      accentHover: '#0090c7',
      accentMuted: 'rgba(0, 166, 226, 0.15)',
      borderDefault: 'rgba(30, 41, 59, 0.1)',
      borderHover: 'rgba(30, 41, 59, 0.2)',
      shadowCard: '0 4px 20px rgba(30, 41, 59, 0.08)',
      shadowAccent: '0 4px 20px -2px rgba(0, 166, 226, 0.2)',
    },
    fonts: {
      heading: "'Inter', sans-serif",
      body: "'Inter', sans-serif",
      headingWeight: '700',
    },
  },

  // NORDIC - Scandinavian minimal with soft blue
  nordic: {
    dark: {
      bgPrimary: '#0a0a0c',
      bgSecondary: '#101012',
      bgSurface: '#16161a',
      bgCard: '#1c1c20',
      bgHover: '#232328',
      bgOverlay: '#16161a',
      textPrimary: '#e5e5e5',
      textSecondary: '#a3a3a3',
      textMuted: '#737373',
      textInverted: '#0a0a0c',
      accent: '#8ac8f0',
      accentHover: '#a0d4f5',
      accentMuted: 'rgba(138, 200, 240, 0.3)',
      borderDefault: 'rgba(255, 255, 255, 0.08)',
      borderHover: 'rgba(255, 255, 255, 0.15)',
      shadowCard: '0 4px 20px rgba(0, 0, 0, 0.3)',
      shadowAccent: '0 4px 20px -2px rgba(138, 200, 240, 0.2)',
    },
    light: {
      bgPrimary: '#ffffff',
      bgSecondary: '#fafafa',
      bgSurface: '#ffffff',
      bgCard: '#ffffff',
      bgHover: '#f5f5f7',
      bgOverlay: '#ffffff',
      textPrimary: '#333333',
      textSecondary: '#666666',
      textMuted: '#a9a9a9',
      textInverted: '#ffffff',
      accent: '#65b2e8',
      accentHover: '#4da3de',
      accentMuted: 'rgba(101, 178, 232, 0.15)',
      borderDefault: 'rgba(51, 51, 51, 0.1)',
      borderHover: 'rgba(51, 51, 51, 0.2)',
      shadowCard: '0 4px 20px rgba(51, 51, 51, 0.06)',
      shadowAccent: '0 4px 20px -2px rgba(101, 178, 232, 0.15)',
    },
    fonts: {
      heading: "'DM Sans', sans-serif",
      body: "'Inter', sans-serif",
      headingWeight: '400',
    },
  },
};

// Helper to get current theme colors
export function getThemeColors(layout: LayoutTheme, colorMode: ColorMode): ThemeColors {
  return themes[layout][colorMode];
}

// Helper to get current theme fonts
export function getThemeFonts(layout: LayoutTheme): ThemeFonts {
  return themes[layout].fonts;
}

// CSS Variables generator
export function generateCSSVariables(layout: LayoutTheme, colorMode: ColorMode): string {
  const colors = getThemeColors(layout, colorMode);
  const fonts = getThemeFonts(layout);

  return `
    --color-bg-primary: ${colors.bgPrimary};
    --color-bg-secondary: ${colors.bgSecondary};
    --color-bg-surface: ${colors.bgSurface};
    --color-bg-card: ${colors.bgCard};
    --color-bg-hover: ${colors.bgHover};
    --color-bg-overlay: ${colors.bgOverlay};
    --color-text-primary: ${colors.textPrimary};
    --color-text-secondary: ${colors.textSecondary};
    --color-text-muted: ${colors.textMuted};
    --color-text-inverted: ${colors.textInverted};
    --color-accent: ${colors.accent};
    --color-accent-hover: ${colors.accentHover};
    --color-accent-muted: ${colors.accentMuted};
    --color-border-default: ${colors.borderDefault};
    --color-border-hover: ${colors.borderHover};
    --shadow-card: ${colors.shadowCard};
    --shadow-accent: ${colors.shadowAccent};
    --font-heading: ${fonts.heading};
    --font-body: ${fonts.body};
    --font-heading-weight: ${fonts.headingWeight};
  `;
}
