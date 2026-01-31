'use client';

import { useEffect } from 'react';
import { useThemeStore, type ColorMode, type LayoutTheme } from '@/stores/themeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { colorMode, layout } = useThemeStore();

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyThemeToDocument(colorMode, layout);
  }, [colorMode, layout]);

  // Prevent flash of wrong theme on initial load
  useEffect(() => {
    // Check for stored theme preference
    const storedTheme = localStorage.getItem('theme-storage');
    if (storedTheme) {
      try {
        const parsed = JSON.parse(storedTheme);
        if (parsed.state) {
          applyThemeToDocument(
            parsed.state.colorMode || 'dark',
            parsed.state.layout || 'default'
          );
        }
      } catch {
        // Default to default dark if parsing fails
        applyThemeToDocument('dark', 'default');
      }
    }
  }, []);

  // Script to prevent FOUC (Flash of Unstyled Content)
  // This runs before React hydrates
  const themeScript = `
    (function() {
      try {
        var stored = localStorage.getItem('theme-storage');
        if (stored) {
          var parsed = JSON.parse(stored);
          var colorMode = (parsed.state && parsed.state.colorMode) || 'dark';
          var layout = (parsed.state && parsed.state.layout) || 'default';
          document.documentElement.setAttribute('data-color-mode', colorMode);
          document.documentElement.setAttribute('data-layout', layout);
          document.documentElement.classList.add(colorMode, layout);
        } else {
          document.documentElement.setAttribute('data-color-mode', 'dark');
          document.documentElement.setAttribute('data-layout', 'default');
          document.documentElement.classList.add('dark', 'default');
        }
      } catch (e) {
        document.documentElement.setAttribute('data-color-mode', 'dark');
        document.documentElement.setAttribute('data-layout', 'default');
        document.documentElement.classList.add('dark', 'default');
      }
    })();
  `;

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: themeScript }}
        suppressHydrationWarning
      />
      {children}
    </>
  );
}

// Helper function to apply theme to document
function applyThemeToDocument(colorMode: ColorMode, layout: LayoutTheme) {
  if (typeof window === 'undefined') return;

  const html = document.documentElement;

  // Set data attributes
  html.setAttribute('data-color-mode', colorMode);
  html.setAttribute('data-layout', layout);

  // Update classes
  html.classList.remove('dark', 'light');
  html.classList.add(colorMode);

  html.classList.remove('default', 'bioscience', 'heritage', 'cosmos', 'nordic');
  html.classList.add(layout);
}

// Hook to use theme values
export function useTheme() {
  const { colorMode, layout, setColorMode, setLayout, toggleColorMode } = useThemeStore();

  return {
    colorMode,
    layout,
    setColorMode,
    setLayout,
    toggleColorMode,
    isDark: colorMode === 'dark',
    isLight: colorMode === 'light',
  };
}
