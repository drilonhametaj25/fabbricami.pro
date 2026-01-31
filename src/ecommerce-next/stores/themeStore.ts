'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'dark' | 'light';
export type LayoutTheme = 'default' | 'bioscience' | 'heritage' | 'cosmos' | 'nordic';

interface ThemeStore {
  colorMode: ColorMode;
  layout: LayoutTheme;

  // Actions
  setColorMode: (mode: ColorMode) => void;
  setLayout: (layout: LayoutTheme) => void;
  toggleColorMode: () => void;

  // Getters
  isDark: () => boolean;
  isLight: () => boolean;
  getThemeClass: () => string;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      colorMode: 'dark',
      layout: 'default',

      setColorMode: (mode: ColorMode) => {
        set({ colorMode: mode });
        updateDocumentTheme(mode, get().layout);
      },

      setLayout: (layout: LayoutTheme) => {
        set({ layout });
        updateDocumentTheme(get().colorMode, layout);
      },

      toggleColorMode: () => {
        const newMode = get().colorMode === 'dark' ? 'light' : 'dark';
        set({ colorMode: newMode });
        updateDocumentTheme(newMode, get().layout);
      },

      isDark: () => get().colorMode === 'dark',
      isLight: () => get().colorMode === 'light',
      getThemeClass: () => `${get().colorMode} ${get().layout}`,
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        // Apply theme on hydration
        if (state) {
          updateDocumentTheme(state.colorMode, state.layout);
        }
      },
    }
  )
);

// Helper function to update document classes and data attributes
function updateDocumentTheme(colorMode: ColorMode, layout: LayoutTheme) {
  if (typeof window === 'undefined') return;

  const html = document.documentElement;

  // Set data attributes for CSS selectors
  html.setAttribute('data-color-mode', colorMode);
  html.setAttribute('data-layout', layout);

  // Update classes
  html.classList.remove('dark', 'light');
  html.classList.add(colorMode);

  html.classList.remove('default', 'bioscience', 'heritage', 'cosmos', 'nordic');
  html.classList.add(layout);
}

// Layout theme metadata for UI display
export const layoutThemes: Record<LayoutTheme, {
  name: string;
  description: string;
  accent: string;
  accentDark: string;
}> = {
  default: {
    name: 'Default',
    description: 'Luxury gold accents',
    accent: '#c9a227',
    accentDark: '#c9a227',
  },
  bioscience: {
    name: 'Bioscience',
    description: 'Clean & minimal',
    accent: '#445e5f',
    accentDark: '#6b9b9c',
  },
  heritage: {
    name: 'Heritage',
    description: 'Warm earth tones',
    accent: '#ad4b1a',
    accentDark: '#d4693d',
  },
  cosmos: {
    name: 'Cosmos',
    description: 'Tech premium',
    accent: '#00a6e2',
    accentDark: '#22c8ff',
  },
  nordic: {
    name: 'Nordic',
    description: 'Scandinavian minimal',
    accent: '#65b2e8',
    accentDark: '#8ac8f0',
  },
};
