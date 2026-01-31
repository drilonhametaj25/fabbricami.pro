'use client';

import { useEffect, useState, useRef } from 'react';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { useThemeStore, layoutThemes, type LayoutTheme } from '@/stores/themeStore';
import { cn } from '@/lib/utils';

interface LayoutSwitcherProps {
  className?: string;
}

export function LayoutSwitcher({ className }: LayoutSwitcherProps) {
  const { layout, colorMode, setLayout } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  if (!mounted) {
    return (
      <button
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-full',
          'transition-all duration-300',
          className
        )}
        disabled
      >
        <Palette className="w-4 h-4 opacity-50" />
        <span className="text-sm opacity-50">Theme</span>
      </button>
    );
  }

  const currentTheme = layoutThemes[layout];
  const isDark = colorMode === 'dark';

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-full',
          'transition-all duration-300 ease-out-expo',
          'hover:bg-theme-bg-hover',
          'focus:outline-none focus:ring-2 focus:ring-theme-accent/30',
          'group'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select theme layout"
      >
        {/* Color swatch */}
        <span
          className="w-4 h-4 rounded-full border border-theme-border"
          style={{
            backgroundColor: isDark ? currentTheme.accentDark : currentTheme.accent,
          }}
        />
        <span className="text-sm font-medium text-theme-text-primary hidden sm:inline">
          {currentTheme.name}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-theme-text-muted transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 w-64 py-2',
            'rounded-xl border border-theme-border',
            'shadow-lg shadow-black/20',
            'animate-fade-in',
            'z-50'
          )}
          style={{ backgroundColor: 'var(--color-bg-card)' }}
          role="listbox"
          aria-label="Theme layouts"
        >
          <div className="px-3 py-2 border-b border-theme-border">
            <span className="text-xs uppercase tracking-wider text-theme-text-muted font-medium">
              Layout Themes
            </span>
          </div>

          <div className="py-1">
            {(Object.keys(layoutThemes) as LayoutTheme[]).map((themeKey) => {
              const theme = layoutThemes[themeKey];
              const isSelected = layout === themeKey;

              return (
                <button
                  key={themeKey}
                  onClick={() => {
                    setLayout(themeKey);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5',
                    'transition-all duration-200',
                    'hover:bg-theme-bg-hover',
                    isSelected && 'bg-theme-bg-surface'
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* Color swatches (light + dark) */}
                  <div className="flex -space-x-1">
                    <span
                      className="w-5 h-5 rounded-full border-2 border-theme-bg-card"
                      style={{ backgroundColor: theme.accent }}
                      title="Light mode"
                    />
                    <span
                      className="w-5 h-5 rounded-full border-2 border-theme-bg-card"
                      style={{ backgroundColor: theme.accentDark }}
                      title="Dark mode"
                    />
                  </div>

                  {/* Theme info */}
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-theme-text-primary">
                      {theme.name}
                    </div>
                    <div className="text-xs text-theme-text-muted">
                      {theme.description}
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <Check
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: 'var(--color-accent)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-theme-border">
            <span className="text-xs text-theme-text-muted">
              Use the sun/moon toggle for dark/light mode
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
