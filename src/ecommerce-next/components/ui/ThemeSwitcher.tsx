'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/lib/utils';

interface ThemeSwitcherProps {
  className?: string;
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { colorMode, toggleColorMode } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder with same dimensions to prevent layout shift
    return (
      <button
        className={cn(
          'relative w-10 h-10 rounded-full flex items-center justify-center',
          'transition-all duration-300',
          className
        )}
        aria-label="Toggle theme"
        disabled
      >
        <div className="w-5 h-5 bg-current opacity-30 rounded-full" />
      </button>
    );
  }

  const isDark = colorMode === 'dark';

  return (
    <button
      onClick={toggleColorMode}
      className={cn(
        'relative w-10 h-10 rounded-full flex items-center justify-center',
        'transition-all duration-300 ease-out-expo',
        'hover:bg-theme-bg-hover',
        'focus:outline-none focus:ring-2 focus:ring-theme-accent/30',
        'group',
        className
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {/* Sun icon (shown in dark mode) */}
      <Sun
        className={cn(
          'absolute w-5 h-5 transition-all duration-300 ease-out-expo',
          isDark
            ? 'opacity-100 rotate-0 scale-100'
            : 'opacity-0 rotate-90 scale-0',
          'text-theme-text-primary group-hover:text-theme-accent'
        )}
      />

      {/* Moon icon (shown in light mode) */}
      <Moon
        className={cn(
          'absolute w-5 h-5 transition-all duration-300 ease-out-expo',
          isDark
            ? 'opacity-0 -rotate-90 scale-0'
            : 'opacity-100 rotate-0 scale-100',
          'text-theme-text-primary group-hover:text-theme-accent'
        )}
      />

      {/* Hover glow effect */}
      <span
        className={cn(
          'absolute inset-0 rounded-full transition-all duration-300',
          'opacity-0 group-hover:opacity-100',
          'bg-theme-accent/10'
        )}
      />
    </button>
  );
}
