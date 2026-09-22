# Theme System Documentation

## Overview

The Ammoura theme system provides a robust, type-safe way to manage light/dark
themes with system preference support. It's designed to be bulletproof with
proper SSR handling, memory leak prevention, and comprehensive error handling.

## Features

- ✅ **Three theme modes**: Light, Dark, and System (follows OS preference)
- ✅ **Zero FOUC**: Theme is applied before page render via inline script
- ✅ **SSR-safe**: All browser-dependent code is properly guarded
- ✅ **Type-safe**: Full TypeScript support with exported types
- ✅ **Memory leak free**: Proper cleanup of event listeners
- ✅ **Error resilient**: Comprehensive error handling throughout
- ✅ **localStorage persistence**: Theme preference survives page reloads
- ✅ **System theme tracking**: Automatically updates when OS theme changes

## Architecture

### Core Files

1. **`src/lib/types/theme.ts`** - Type definitions
2. **`src/lib/stores/theme.ts`** - Theme store implementation
3. **`src/lib/components/ThemeToggle.svelte`** - Toggle button component
4. **`src/app.html`** - FOUC prevention script
5. **`src/app.css`** - Theme CSS variables

### Type System

```typescript
// Available theme options
export type Theme = 'light' | 'dark' | 'system';

// The actual applied theme (no 'system' option)
export type AppliedTheme = 'light' | 'dark';

// Theme store interface
export interface ThemeStore {
  subscribe: (callback: (theme: Theme) => void) => () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initTheme: () => void;
  cleanup: () => void;
}
```

## Usage

### Basic Setup

In your root layout (`+layout.svelte`):

```svelte
<script lang="ts">
  import { themeStore } from '$lib/stores/theme';
  import { onMount, onDestroy } from 'svelte';

  onMount(() => {
    themeStore.initTheme();
  });

  onDestroy(() => {
    themeStore.cleanup();
  });
</script>
```

### Using the Theme Store

```typescript
import { themeStore } from '$lib/stores/theme';

// Set theme explicitly
themeStore.setTheme('dark');
themeStore.setTheme('light');
themeStore.setTheme('system');

// Toggle between light and dark
themeStore.toggleTheme();

// Subscribe to theme changes
const unsubscribe = themeStore.subscribe((theme) => {
  console.log('Current theme:', theme);
});
```

### Theme Toggle Component

```svelte
<script>
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
</script>

<ThemeToggle />
```

### Custom Theme Controls

```svelte
<script lang="ts">
  import { themeStore } from '$lib/stores/theme';

  $: currentTheme = $themeStore;
</script>

<div class="theme-selector">
  <button class:active={currentTheme === 'light'} on:click={() => themeStore.setTheme('light')}>
    Light
  </button>
  <button class:active={currentTheme === 'dark'} on:click={() => themeStore.setTheme('dark')}>
    Dark
  </button>
  <button class:active={currentTheme === 'system'} on:click={() => themeStore.setTheme('system')}>
    System
  </button>
</div>
```

## CSS Variables

The theme system uses CSS custom properties defined in `src/app.css`:

### Light Theme (`:root`)

```css
:root {
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-bg-primary: #f8fafc;
  --color-bg-secondary: #ffffff;
  --color-text-primary: #1e293b;
  --color-text-secondary: #64748b;
  /* ... more variables */
}
```

### Dark Theme (`[data-theme='dark']`)

```css
[data-theme='dark'] {
  --color-primary: #60a5fa;
  --color-primary-hover: #3b82f6;
  --color-bg-primary: #1e293b;
  --color-bg-secondary: #0f172a;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #cbd5e1;
  /* ... more variables */
}
```

### Using CSS Variables

```css
.my-component {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
}

.my-button {
  background: var(--color-primary);
  transition: background var(--transition-normal);
}

.my-button:hover {
  background: var(--color-primary-hover);
}
```

## Implementation Details

### FOUC Prevention

FOUC (Flash of Unstyled Content) prevention is implemented at multiple levels:

#### 1. Immediate Theme Application (app.html)

The inline script in `app.html` runs before any framework code:

```html
<script>
  (function () {
    try {
      const stored = localStorage.getItem('theme');
      const validThemes = ['light', 'dark', 'system'];
      const isValid = stored && validThemes.includes(stored);
      const theme = isValid ? stored : 'system';

      let actualTheme = theme;
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        actualTheme = prefersDark ? 'dark' : 'light';
      }

      document.documentElement.setAttribute('data-theme', actualTheme);
      document.documentElement.classList.add('theme-loaded');
    } catch (e) {
      console.warn('Failed to initialize theme:', e);
    }
  })();
</script>
```

#### 2. CSS Variable Fallbacks (app.css)

The `app.css` file defines fallback values for all `--color-*` and `--theme-*`
CSS variables in both `:root` (light) and `[data-theme='dark']` selectors. These
fallbacks ensure that even before the dynamic database-loaded styles are
injected via `+layout.svelte`, the page renders with correct theme colors.

```css
:root {
  /* FOUC Prevention: Fallback color values for --color-* variables */
  --color-primary: #ec4899;
  --color-bg-primary: #ffffff;
  --color-text-primary: #1e1b4b;
  /* ... more fallbacks ... */
}

[data-theme='dark'] {
  /* FOUC Prevention: Fallback color values for dark mode */
  --color-primary: #a78bfa;
  --color-bg-primary: #0f172a;
  --color-text-primary: #f1f5f9;
  /* ... more fallbacks ... */
}
```

#### 3. Component Fallbacks

UI components (NavBar, Footer, etc.) must use CSS variable fallbacks instead of
hardcoded hex colors. This ensures they adapt automatically to the theme:

```typescript
// ❌ BAD - causes FOUC in dark mode
$: textColor = config.navbarTextColor || '#000000';

// ✅ GOOD - automatically adapts to theme
$: textColor = config.navbarTextColor || 'var(--theme-text)';
```

#### 4. Visibility Control (app.css)

As a final safeguard, the page is hidden until the theme is fully loaded:

```css
/* Prevent flash during theme loading */
html:not(.theme-loaded) {
  visibility: hidden;
}

html.theme-loaded {
  visibility: visible;
}
```

### SSR Safety

All browser-dependent code is wrapped in `if (browser)` checks:

```typescript
import { browser } from '$app/environment';

const applyTheme = (theme: Theme): void => {
  if (!browser) return; // SSR guard

  try {
    const actualTheme = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.setAttribute('data-theme', actualTheme);
  } catch (error) {
    console.error('Failed to apply theme:', error);
  }
};
```

### Memory Management

The store properly manages event listeners:

```typescript
let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
let mediaQuery: MediaQueryList | null = null;

const cleanupMediaQueryListener = (): void => {
  if (browser && mediaQuery && mediaQueryListener) {
    mediaQuery.removeEventListener('change', mediaQueryListener);
    mediaQueryListener = null;
    mediaQuery = null;
  }
};
```

Always call `cleanup()` in `onDestroy`:

```svelte
<script>
  import { onDestroy } from 'svelte';
  import { themeStore } from '$lib/stores/theme';

  onDestroy(() => {
    themeStore.cleanup();
  });
</script>
```

### Toggle Behavior

The toggle function intelligently handles all three theme states:

- **Light → Dark**: Switches to dark mode
- **Dark → Light**: Switches to light mode
- **System → Opposite**: Switches to the opposite of current system preference
  - If system is light, switches to dark
  - If system is dark, switches to light

## Testing

The theme system includes comprehensive tests. To run them:

```bash
npm test -- src/lib/stores/theme.test.ts
```

Tests cover:

- Setting theme explicitly
- Toggle behavior
- localStorage persistence
- System theme initialization
- Validation of stored values
- Cleanup and memory management

## Troubleshooting

### Theme not persisting after reload

- Check browser localStorage is enabled
- Verify no errors in console during theme initialization

### Theme flashes wrong color on load (FOUC)

- Ensure inline script in `app.html` is present
- Check that script runs before any styles load

### System theme not updating

- Verify `themeStore.initTheme()` is called in `onMount`
- Check that `cleanup()` isn't called prematurely

### Memory leaks

- Always call `themeStore.cleanup()` in `onDestroy`
- Don't create multiple instances of the theme store

### Tests failing

- Ensure `tests/setup.ts` properly mocks `$app/environment`
- Verify localStorage and matchMedia are mocked in tests

## Best Practices

1. **Initialize once**: Call `initTheme()` only once in root layout
2. **Always cleanup**: Call `cleanup()` in `onDestroy` of root layout
3. **Use CSS variables**: Reference theme colors via CSS custom properties
4. **Type imports**: Import and use the `Theme` type for type safety
5. **Error handling**: All store methods include error handling, but check
   console for warnings
6. **SSR awareness**: Never access `window` or `document` outside browser guards

## Migration Guide

If updating from an old theme system:

1. Replace old theme store with new bulletproof version
2. Update imports to include type:
   `import { themeStore, type Theme } from '$lib/stores/theme'`
3. Add `onDestroy` cleanup if not present
4. Update CSS to use `[data-theme='dark']` selector
5. Update inline script in `app.html` with error handling
6. Run tests to verify functionality

## Future Enhancements

Potential improvements for future versions:

- Theme transition animations
- Multiple custom themes beyond light/dark
- Per-page theme overrides
- Theme scheduling (auto-switch at specific times)
- Theme presets with predefined color schemes
- Import/export theme configurations
