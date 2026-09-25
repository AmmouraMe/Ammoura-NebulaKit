<script lang="ts">
  import { onMount } from 'svelte';
  import { confirmStore } from '$lib/stores/confirm';
  import { toastStore } from '$lib/stores/toast';
  import { themeStore } from '$lib/stores/theme';
  import { themePreviewStore } from '$lib/stores/themePreview';
  import type { ColorThemeDefinition } from '$lib/types/pages';
  import {
    generateThemeStyles,
    getCurrentlyViewingTheme,
    setCurrentlyViewingTheme
  } from '$lib/utils/editor/colorThemes';

  let themes: ColorThemeDefinition[] = [];
  let editingTheme: ColorThemeDefinition | null = null;
  let showEditor = false;
  let filterMode: 'all' | 'light' | 'dark' = 'all';
  let loading = true;

  let systemLightTheme: string = '';
  let systemDarkTheme: string = '';
  let currentlyViewingTheme: string | null = getCurrentlyViewingTheme();

  let draggedIndex: number | null = null;
  let dragOverIndex: number | null = null;
  let colorHarmonyMode:
    | 'none'
    | 'complementary'
    | 'triadic'
    | 'tetradic'
    | 'analogous'
    | 'split'
    | 'monochromatic'
    | 'double-split' = 'none';
  let originalThemeSnapshot: ColorThemeDefinition | null = null;
  let colorWheelCanvas: HTMLCanvasElement | undefined;

  // Drag state for color wheel
  let isDraggingColor = false;
  let draggedColorKey: 'primary' | 'secondary' | 'accent' | null = null;
  let hoveredColorKey: 'primary' | 'secondary' | 'accent' | null = null;
  let isHarmonyExpanded = false;
  let wheelBrightness = 60; // Brightness/lightness for color wheel (0-100)

  $: filteredThemes = themes.filter((t) => (filterMode === 'all' ? true : t.mode === filterMode));
  $: lightThemes = themes.filter((t) => t.mode === 'light');
  $: darkThemes = themes.filter((t) => t.mode === 'dark');

  // Check if theme has unsaved changes
  // For new themes (originalThemeSnapshot is null), always show as having changes
  $: hasUnsavedChanges = editingTheme
    ? originalThemeSnapshot === null
      ? true
      : JSON.stringify(editingTheme) !== JSON.stringify(originalThemeSnapshot)
    : false;

  // Reactive value for current active theme ID - will update when any dependency changes
  $: activeThemeId = (() => {
    // If currently previewing a theme, that's the active one
    if (currentlyViewingTheme) {
      return currentlyViewingTheme;
    }
    // Otherwise, return the current system theme based on light/dark mode
    const actualTheme =
      $themeStore === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : $themeStore;
    const themeId = actualTheme === 'light' ? systemLightTheme : systemDarkTheme;
    // Fallback to defaults if not loaded yet
    return themeId || (actualTheme === 'light' ? 'vibrant' : 'midnight');
  })();

  onMount(() => {
    // Load data
    loadPreferences();
    loadThemes();

    // Check if there's a stored preview theme
    const stored = getCurrentlyViewingTheme();
    if (stored) {
      // User was previewing a theme, keep that preview active
      currentlyViewingTheme = stored;
      applyThemePreview(stored);

      // Restore preview in the store
      const theme = themes.find((t) => t.id === stored);
      if (theme) {
        themePreviewStore.startPreview(theme);
      }
    } else {
      // No preview stored - determine which theme is currently active for the system
      // This ensures the correct button is highlighted on page load
      // No preview stored - just let the reactive statement handle highlighting
      // This way the button shows as active but we're not in "preview mode"
    }

    // Listen for stop preview event from ThemePreviewIndicator
    const handleStopPreview = (): void => {
      if (currentlyViewingTheme) {
        setCurrentlyViewingTheme(null);
        currentlyViewingTheme = null;
        clearThemePreview();
        toastStore.info('Preview disabled');
      }
    };

    window.addEventListener('stopThemePreview', handleStopPreview);

    return () => {
      window.removeEventListener('stopThemePreview', handleStopPreview);
    };
  });

  async function loadThemes() {
    try {
      loading = true;
      const response = await fetch('/api/color-themes');
      if (!response.ok) throw new Error('Failed to load themes');
      const data = (await response.json()) as { themes: ColorThemeDefinition[] };
      // Sort themes: current system themes first, then other themes
      themes = data.themes.sort((a, b) => {
        const aIsSystemTheme = a.id === systemLightTheme || a.id === systemDarkTheme;
        const bIsSystemTheme = b.id === systemLightTheme || b.id === systemDarkTheme;
        if (aIsSystemTheme && !bIsSystemTheme) return -1;
        if (!aIsSystemTheme && bIsSystemTheme) return 1;
        // If both are system themes, light comes before dark
        if (aIsSystemTheme && bIsSystemTheme) {
          if (a.id === systemLightTheme) return -1;
          if (b.id === systemLightTheme) return 1;
        }
        return 0;
      });
    } catch (error) {
      console.error('Error loading themes:', error);
      toastStore.error('Failed to load themes');
    } finally {
      loading = false;
    }
  }

  async function loadPreferences() {
    try {
      const [lightResponse, darkResponse] = await Promise.all([
        fetch('/api/color-themes/preferences?key=system-light-theme'),
        fetch('/api/color-themes/preferences?key=system-dark-theme')
      ]);

      if (lightResponse.ok) {
        const data = (await lightResponse.json()) as { value: string };
        systemLightTheme = data.value || 'vibrant';
      }

      if (darkResponse.ok) {
        const data = (await darkResponse.json()) as { value: string };
        systemDarkTheme = data.value || 'midnight';
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }

  // Color harmony helpers
  function hexToHSL(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, l: 50 };

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function HSLToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

    const r = Math.round(255 * f(0));
    const g = Math.round(255 * f(8));
    const b = Math.round(255 * f(4));

    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }

  function applyColorHarmony(baseColor: string, mode: typeof colorHarmonyMode): void {
    if (!editingTheme || mode === 'none') return;

    const hsl = hexToHSL(baseColor);

    switch (mode) {
      case 'complementary':
        editingTheme.colors.secondary = HSLToHex((hsl.h + 180) % 360, hsl.s, hsl.l);
        break;
      case 'triadic':
        editingTheme.colors.secondary = HSLToHex((hsl.h + 120) % 360, hsl.s, hsl.l);
        editingTheme.colors.accent = HSLToHex((hsl.h + 240) % 360, hsl.s, hsl.l);
        break;
      case 'analogous':
        editingTheme.colors.secondary = HSLToHex((hsl.h + 30) % 360, hsl.s, hsl.l);
        editingTheme.colors.accent = HSLToHex((hsl.h - 30 + 360) % 360, hsl.s, hsl.l);
        break;
      case 'split':
        editingTheme.colors.secondary = HSLToHex((hsl.h + 150) % 360, hsl.s, hsl.l);
        editingTheme.colors.accent = HSLToHex((hsl.h + 210) % 360, hsl.s, hsl.l);
        break;
    }

    // Redraw color wheel after harmony changes
    if (colorWheelCanvas) {
      drawColorWheel();
    }
  }

  function drawColorWheel(): void {
    if (!colorWheelCanvas || !editingTheme) return;

    const ctx = colorWheelCanvas.getContext('2d');
    if (!ctx) return;

    const size = 280;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 20;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw color wheel with saturation gradient using pixel-perfect approach
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= radius) {
          // Calculate hue from angle
          let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
          if (angle < 0) angle += 360;

          // Calculate saturation from distance (0% at center, 100% at edge)
          const saturation = (distance / radius) * 100;

          // Use wheelBrightness as the base lightness for the entire wheel
          // This creates a proper color picker where:
          // - Center (0% saturation) = desaturated brightness color (gray/white depending on brightness)
          // - Edge (100% saturation) = fully saturated color at current brightness
          const lightness = wheelBrightness;

          // Convert HSL to RGB
          const h = angle / 60;
          const s = saturation / 100;
          const l = lightness / 100;

          const c = (1 - Math.abs(2 * l - 1)) * s;
          const x1 = c * (1 - Math.abs((h % 2) - 1));
          const m = l - c / 2;

          let r = 0,
            g = 0,
            b = 0;
          if (h >= 0 && h < 1) {
            r = c;
            g = x1;
            b = 0;
          } else if (h >= 1 && h < 2) {
            r = x1;
            g = c;
            b = 0;
          } else if (h >= 2 && h < 3) {
            r = 0;
            g = c;
            b = x1;
          } else if (h >= 3 && h < 4) {
            r = 0;
            g = x1;
            b = c;
          } else if (h >= 4 && h < 5) {
            r = x1;
            g = 0;
            b = c;
          } else if (h >= 5 && h < 6) {
            r = c;
            g = 0;
            b = x1;
          }

          const index = (y * size + x) * 4;
          data[index] = Math.round((r + m) * 255);
          data[index + 1] = Math.round((g + m) * 255);
          data[index + 2] = Math.round((b + m) * 255);
          data[index + 3] = 255; // Alpha
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Define which colors to show on the wheel (focal colors only)
    const wheelColors: Array<{ key: string; color: string; label: string }> = [
      { key: 'primary', color: editingTheme.colors.primary, label: 'Primary' },
      { key: 'secondary', color: editingTheme.colors.secondary, label: 'Secondary' },
      { key: 'accent', color: editingTheme.colors.accent, label: 'Accent' }
    ];

    // Draw harmony lines if mode is active
    if (colorHarmonyMode !== 'none') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      wheelColors.forEach((colorInfo) => {
        const hsl = hexToHSL(colorInfo.color);
        const angle = hsl.h;
        const saturation = hsl.s / 100;
        const lineRadius = radius * saturation;
        const x = centerX + Math.cos(((angle - 90) * Math.PI) / 180) * lineRadius;
        const y = centerY + Math.sin(((angle - 90) * Math.PI) / 180) * lineRadius;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
      });

      ctx.setLineDash([]);
    }

    // Draw color dots on the wheel
    wheelColors.forEach((colorInfo) => {
      const hsl = hexToHSL(colorInfo.color);
      const angle = hsl.h;
      const saturation = hsl.s / 100; // Convert to 0-1 range
      const dotRadius = radius * saturation; // Position based on saturation
      const x = centerX + Math.cos(((angle - 90) * Math.PI) / 180) * dotRadius;
      const y = centerY + Math.sin(((angle - 90) * Math.PI) / 180) * dotRadius;

      const isHovered = hoveredColorKey === colorInfo.key;
      const isDragged = draggedColorKey === colorInfo.key;
      const dotSize = isHovered || isDragged ? 18 : 16;

      // Draw dot
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, 2 * Math.PI);
      ctx.fillStyle = colorInfo.color;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = isDragged ? 4 : 3;
      ctx.stroke();
      ctx.strokeStyle = isDragged ? '#000' : '#333';
      ctx.lineWidth = isDragged ? 2 : 1;
      ctx.stroke();

      // Draw hover ring
      if (isHovered && !isDragged) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  // Track previous brightness to detect changes
  let previousBrightness = wheelBrightness;

  // Reactive statement to redraw wheel when colors change
  $: if (editingTheme && colorWheelCanvas) {
    drawColorWheel();
  }

  // Update all color lightness when brightness slider changes (not when dragging colors)
  $: if (editingTheme && !isDraggingColor && wheelBrightness !== previousBrightness) {
    const primaryHSL = hexToHSL(editingTheme.colors.primary);
    const secondaryHSL = hexToHSL(editingTheme.colors.secondary);
    const accentHSL = hexToHSL(editingTheme.colors.accent);

    // Only update if the lightness actually differs from wheelBrightness
    if (Math.abs(primaryHSL.l - wheelBrightness) > 0.5) {
      editingTheme.colors.primary = HSLToHex(primaryHSL.h, primaryHSL.s, wheelBrightness);
      editingTheme.colors.secondary = HSLToHex(secondaryHSL.h, secondaryHSL.s, wheelBrightness);
      editingTheme.colors.accent = HSLToHex(accentHSL.h, accentHSL.s, wheelBrightness);
      editingTheme = editingTheme;
    }

    previousBrightness = wheelBrightness;
  }

  // Color wheel drag handlers
  function getColorAtPosition(
    x: number,
    y: number
  ): {
    colorKey: 'primary' | 'secondary' | 'accent';
    distance: number;
  } | null {
    if (!editingTheme || !colorWheelCanvas) return null;

    const rect = colorWheelCanvas.getBoundingClientRect();

    // Convert mouse coordinates to canvas coordinates
    const scaleX = colorWheelCanvas.width / rect.width;
    const scaleY = colorWheelCanvas.height / rect.height;
    const canvasX = (x - rect.left) * scaleX;
    const canvasY = (y - rect.top) * scaleY;

    const size = 280;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 20;

    const wheelColors = [
      { key: 'primary' as const, color: editingTheme.colors.primary },
      { key: 'secondary' as const, color: editingTheme.colors.secondary },
      { key: 'accent' as const, color: editingTheme.colors.accent }
    ];

    // Check if click is near any color dot (within 20px)
    for (const colorInfo of wheelColors) {
      const hsl = hexToHSL(colorInfo.color);
      const angle = hsl.h;

      // Position dot based on saturation (distance from center)
      const saturation = hsl.s / 100;
      const dotRadius = radius * saturation;
      const dotX = centerX + Math.cos(((angle - 90) * Math.PI) / 180) * dotRadius;
      const dotY = centerY + Math.sin(((angle - 90) * Math.PI) / 180) * dotRadius;

      const distance = Math.sqrt((canvasX - dotX) ** 2 + (canvasY - dotY) ** 2);

      if (distance <= 20) {
        return { colorKey: colorInfo.key, distance };
      }
    }

    return null;
  }

  function updateColorFromAngle(
    colorKey: 'primary' | 'secondary' | 'accent',
    angle: number,
    saturation: number
  ): void {
    if (!editingTheme) return;

    // Update with new hue angle and saturation, using wheelBrightness for lightness
    const newColor = HSLToHex(angle, saturation, wheelBrightness);
    editingTheme.colors[colorKey] = newColor;

    // If harmony mode is active, update all colors based on the dragged color
    if (colorHarmonyMode !== 'none') {
      const hsl = hexToHSL(newColor);

      // Get current saturation for each color (to preserve individual saturation)
      const primaryHSL = hexToHSL(editingTheme.colors.primary);
      const secondaryHSL = hexToHSL(editingTheme.colors.secondary);
      const accentHSL = hexToHSL(editingTheme.colors.accent);

      switch (colorHarmonyMode) {
        case 'complementary':
          // Primary: dominant color, Secondary: complement (180°), Accent: slight variation of complement
          if (colorKey === 'primary') {
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h + 180) % 360,
              Math.min(secondaryHSL.s, 85),
              wheelBrightness
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h + 165) % 360,
              Math.min(accentHSL.s, 70),
              Math.min(wheelBrightness * 1.08, 100)
            );
          } else if (colorKey === 'secondary') {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h + 180) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h - 15 + 360) % 360,
              Math.min(accentHSL.s, 70),
              Math.min(wheelBrightness * 1.08, 100)
            );
          } else {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h + 195) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h + 15) % 360,
              Math.min(secondaryHSL.s, 85),
              wheelBrightness
            );
          }
          break;
        case 'triadic':
          // True triadic: three colors exactly 120° apart for balanced vibrancy
          if (colorKey === 'primary') {
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h + 120) % 360,
              secondaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h + 240) % 360,
              accentHSL.s,
              wheelBrightness
            );
          } else if (colorKey === 'secondary') {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h + 240) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h + 120) % 360,
              accentHSL.s,
              wheelBrightness
            );
          } else {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h + 120) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h + 240) % 360,
              secondaryHSL.s,
              wheelBrightness
            );
          }
          break;
        case 'tetradic':
          // Square/rectangular: primary and accent as complements, secondary bridges them
          if (colorKey === 'primary') {
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h + 90) % 360,
              Math.min(secondaryHSL.s, 75),
              Math.max(wheelBrightness * 0.92, 0)
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h + 180) % 360,
              Math.min(accentHSL.s, 85),
              wheelBrightness
            );
          } else if (colorKey === 'secondary') {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h - 90 + 360) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h + 90) % 360,
              Math.min(accentHSL.s, 85),
              wheelBrightness
            );
          } else {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h + 180) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h - 90 + 360) % 360,
              Math.min(secondaryHSL.s, 75),
              Math.max(wheelBrightness * 0.92, 0)
            );
          }
          break;
        case 'analogous':
          // Harmonious neighbors: primary in center, secondary and accent flanking closely
          if (colorKey === 'primary') {
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h + 25) % 360,
              Math.max(secondaryHSL.s, hsl.s * 0.85),
              Math.max(wheelBrightness * 0.92, 0)
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h - 25 + 360) % 360,
              Math.max(accentHSL.s, hsl.s * 0.85),
              Math.min(wheelBrightness * 1.08, 100)
            );
          } else if (colorKey === 'secondary') {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h - 25 + 360) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h + 50) % 360,
              Math.max(accentHSL.s, hsl.s * 0.85),
              Math.min(wheelBrightness * 1.08, 100)
            );
          } else {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h + 25) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h - 50 + 360) % 360,
              Math.max(secondaryHSL.s, hsl.s * 0.85),
              Math.max(wheelBrightness * 0.92, 0)
            );
          }
          break;
        case 'split':
          // Split complementary: primary dominant, secondary and accent split the complement
          if (colorKey === 'primary') {
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h + 150) % 360,
              Math.min(secondaryHSL.s, 80),
              Math.max(wheelBrightness * 0.88, 0)
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h + 210) % 360,
              Math.min(accentHSL.s, 80),
              Math.min(wheelBrightness * 1.08, 100)
            );
          } else if (colorKey === 'secondary') {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h - 150 + 360) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h + 60) % 360,
              Math.min(accentHSL.s, 80),
              Math.min(wheelBrightness * 1.08, 100)
            );
          } else {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h - 210 + 360) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h - 60 + 360) % 360,
              Math.min(secondaryHSL.s, 80),
              Math.max(wheelBrightness * 0.88, 0)
            );
          }
          break;
        case 'monochromatic':
          // Same hue, varied saturation and subtle lightness shifts for depth
          if (colorKey === 'primary') {
            editingTheme.colors.secondary = HSLToHex(
              hsl.h,
              Math.max(secondaryHSL.s * 0.7, 40),
              Math.min(wheelBrightness * 1.12, 100)
            );
            editingTheme.colors.accent = HSLToHex(
              hsl.h,
              Math.min(accentHSL.s * 1.2, 95),
              Math.max(wheelBrightness * 0.8, 0)
            );
          } else if (colorKey === 'secondary') {
            editingTheme.colors.primary = HSLToHex(
              hsl.h,
              Math.min(primaryHSL.s * 1.43, 100),
              Math.max(wheelBrightness * 0.85, 0)
            );
            editingTheme.colors.accent = HSLToHex(
              hsl.h,
              Math.min(accentHSL.s * 1.71, 95),
              Math.max(wheelBrightness * 0.7, 0)
            );
          } else {
            editingTheme.colors.primary = HSLToHex(
              hsl.h,
              Math.min(primaryHSL.s * 0.83, 100),
              Math.min(wheelBrightness * 1.15, 100)
            );
            editingTheme.colors.secondary = HSLToHex(
              hsl.h,
              Math.max(secondaryHSL.s * 0.58, 40),
              Math.min(wheelBrightness * 1.25, 100)
            );
          }
          break;
        case 'double-split':
          // Advanced: primary + two sets of split complements for rich, complex palettes
          if (colorKey === 'primary') {
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h + 135) % 360,
              Math.min(secondaryHSL.s, 75),
              Math.max(wheelBrightness * 0.9, 0)
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h + 225) % 360,
              Math.min(accentHSL.s, 75),
              Math.min(wheelBrightness * 1.08, 100)
            );
          } else if (colorKey === 'secondary') {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h - 135 + 360) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.accent = HSLToHex(
              (hsl.h + 90) % 360,
              Math.min(accentHSL.s, 75),
              Math.min(wheelBrightness * 1.08, 100)
            );
          } else {
            editingTheme.colors.primary = HSLToHex(
              (hsl.h - 225 + 360) % 360,
              primaryHSL.s,
              wheelBrightness
            );
            editingTheme.colors.secondary = HSLToHex(
              (hsl.h - 90 + 360) % 360,
              Math.min(secondaryHSL.s, 75),
              Math.max(wheelBrightness * 0.9, 0)
            );
          }
          break;
      }
    }

    // Trigger reactivity
    editingTheme = editingTheme;
  }

  function handleWheelMouseDown(event: MouseEvent): void {
    if (!colorWheelCanvas) return;

    const colorInfo = getColorAtPosition(event.clientX, event.clientY);
    if (colorInfo) {
      isDraggingColor = true;
      draggedColorKey = colorInfo.colorKey;
      colorWheelCanvas.style.cursor = 'grabbing';
    }
  }

  function handleWheelMouseMove(event: MouseEvent): void {
    if (!colorWheelCanvas || !editingTheme) return;

    const rect = colorWheelCanvas.getBoundingClientRect();

    // Convert mouse coordinates to canvas coordinates
    // Account for any scaling between canvas resolution and display size
    const scaleX = colorWheelCanvas.width / rect.width;
    const scaleY = colorWheelCanvas.height / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;

    const size = 280;
    const centerX = size / 2;
    const centerY = size / 2;

    if (isDraggingColor && draggedColorKey) {
      // Calculate angle and distance from center to mouse position
      const dx = canvasX - centerX;
      const dy = canvasY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const radius = size / 2 - 20;

      let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angle < 0) angle += 360;

      // Calculate saturation based on distance (0% at center, 100% at edge)
      // Clamp between 0 and 100, with actual radius boundary
      const saturation = Math.max(0, Math.min(100, (distance / radius) * 100));

      // Update the color with angle and saturation
      updateColorFromAngle(draggedColorKey, angle, saturation);
    } else {
      // Check if hovering over a color dot
      const colorInfo = getColorAtPosition(event.clientX, event.clientY);
      if (colorInfo) {
        hoveredColorKey = colorInfo.colorKey;
        colorWheelCanvas.style.cursor = 'grab';
      } else {
        hoveredColorKey = null;
        colorWheelCanvas.style.cursor = 'default';
      }

      // Redraw to show hover state
      drawColorWheel();
    }
  }

  function handleWheelMouseUp(): void {
    if (colorWheelCanvas) {
      colorWheelCanvas.style.cursor = hoveredColorKey ? 'grab' : 'default';
    }
    isDraggingColor = false;
    draggedColorKey = null;
  }

  function handleWheelMouseLeave(): void {
    if (isDraggingColor) {
      handleWheelMouseUp();
    }
    hoveredColorKey = null;
    if (colorWheelCanvas) {
      colorWheelCanvas.style.cursor = 'default';
    }
  }

  function createNewTheme(mode: 'light' | 'dark'): void {
    const baseTheme =
      themes.find((t) => t.mode === mode && t.isDefault) ||
      themes.find((t) => t.mode === mode) ||
      themes[0];
    editingTheme = {
      id: `custom-${Date.now()}`,
      name: `New ${mode === 'light' ? 'Light' : 'Dark'} Theme`,
      mode,
      isDefault: false,
      isSystem: false,
      colors: baseTheme
        ? { ...baseTheme.colors }
        : {
            primary: '#3b82f6',
            secondary: '#64748b',
            accent: '#8b5cf6',
            background: mode === 'light' ? '#ffffff' : '#0f172a',
            surface: mode === 'light' ? '#f8fafc' : '#1e293b',
            text: mode === 'light' ? '#1e293b' : '#f1f5f9',
            textSecondary: mode === 'light' ? '#64748b' : '#cbd5e1',
            border: mode === 'light' ? '#e2e8f0' : '#334155',
            success: mode === 'light' ? '#10b981' : '#34d399',
            warning: mode === 'light' ? '#f59e0b' : '#fbbf24',
            error: mode === 'light' ? '#ef4444' : '#f87171'
          }
    };
    originalThemeSnapshot = null; // Mark as new theme (not yet saved)
    showEditor = true;
  }

  function editTheme(theme: ColorThemeDefinition) {
    editingTheme = { ...theme, colors: { ...theme.colors } };
    originalThemeSnapshot = { ...theme, colors: { ...theme.colors } };
    showEditor = true;
    // Don't apply preview when opening editor - only on hover
  }

  async function saveTheme() {
    if (!editingTheme) return;

    if (!editingTheme.name.trim()) {
      toastStore.error('Theme name is required');
      return;
    }

    try {
      // If editing a system theme, create a new custom theme instead
      const themeToSave = editingTheme.isSystem
        ? {
            ...editingTheme,
            id: `custom-${Date.now()}`,
            isSystem: false,
            isDefault: false
          }
        : editingTheme;

      const response = await fetch('/api/color-themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(themeToSave)
      });

      if (!response.ok) throw new Error('Failed to save theme');

      toastStore.success(
        editingTheme.isSystem
          ? 'Created custom theme based on system theme'
          : 'Theme saved successfully'
      );

      await loadThemes();
      closeEditor();
    } catch (error) {
      console.error('Error saving theme:', error);
      toastStore.error('Failed to save theme');
    }
  }

  async function deleteTheme(id: string): Promise<void> {
    // Prevent deleting current system themes
    if (id === systemLightTheme || id === systemDarkTheme) {
      toastStore.error(
        'Cannot delete the current system theme. Please set a different theme as system default first.'
      );
      return;
    }

    const confirmed = await confirmStore.show('Are you sure you want to delete this theme?', {
      title: 'Delete Theme',
      confirmText: 'Delete',
      variant: 'danger'
    });
    if (confirmed) {
      try {
        const response = await fetch('/api/color-themes', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ themeId: id })
        });

        if (!response.ok) {
          throw new Error('Failed to delete theme');
        }

        // Clear system theme if deleted
        if (systemLightTheme === id) {
          await setSystemDefault('vibrant', 'light');
        }
        if (systemDarkTheme === id) {
          await setSystemDefault('midnight', 'dark');
        }
        // Clear currently viewing if deleted
        if (currentlyViewingTheme === id) {
          setCurrentlyViewingTheme(null);
          currentlyViewingTheme = null;
        }

        await loadThemes();
        toastStore.success('Theme deleted successfully');
      } catch (error) {
        console.error('Error deleting theme:', error);
        toastStore.error('Failed to delete theme');
      }
    }
  }

  async function setSystemDefault(id: string, mode: 'light' | 'dark'): Promise<void> {
    try {
      const key = mode === 'light' ? 'system-light-theme' : 'system-dark-theme';
      const payload = { key, value: id };

      const response = await fetch('/api/color-themes/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Failed to set system theme:', errorData);
        throw new Error('Failed to set system theme');
      }

      if (mode === 'light') {
        systemLightTheme = id;
      } else {
        systemDarkTheme = id;
      }

      // Reload themes to ensure UI is in sync
      await loadThemes();

      // Check if admin is currently viewing the theme mode that was changed
      const currentTheme = $themeStore;
      const actualTheme =
        currentTheme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : currentTheme;

      // If the admin is viewing the theme mode that was just changed, reload colors immediately
      if (actualTheme === mode) {
        await themeStore.reloadThemeColors();
      }

      toastStore.success(`Set as system ${mode} theme`);
    } catch (error) {
      console.error('Error setting system theme:', error);
      toastStore.error('Failed to set system theme');
    }
  }

  function togglePreview(themeId: string): void {
    // If this theme is already being previewed (not just the active system theme), turn off preview
    if (currentlyViewingTheme === themeId) {
      setCurrentlyViewingTheme(null);
      currentlyViewingTheme = null;
      clearThemePreview();
      themePreviewStore.stopPreview();
      toastStore.info('Preview disabled');
    } else {
      // Otherwise, preview this theme
      const theme = themes.find((t) => t.id === themeId);
      if (theme) {
        setCurrentlyViewingTheme(themeId);
        currentlyViewingTheme = themeId;
        applyThemePreview(themeId);
        themePreviewStore.startPreview(theme);
        toastStore.info(`Previewing: ${theme.name}`);
      }
    }
  }

  function applyThemePreview(themeIdOrTheme: string | ColorThemeDefinition): void {
    // Handle both theme ID and theme object
    const theme =
      typeof themeIdOrTheme === 'string'
        ? themes.find((t) => t.id === themeIdOrTheme) || editingTheme
        : themeIdOrTheme;

    if (!theme) return;

    const root = document.documentElement;
    const colors = theme.colors;

    // Apply theme colors as CSS custom properties
    root.style.setProperty('--theme-primary', colors.primary);
    root.style.setProperty('--theme-secondary', colors.secondary);
    root.style.setProperty('--theme-accent', colors.accent);
    root.style.setProperty('--theme-background', colors.background);
    root.style.setProperty('--theme-surface', colors.surface);
    root.style.setProperty('--theme-text', colors.text);
    root.style.setProperty('--theme-text-secondary', colors.textSecondary);
    root.style.setProperty('--theme-border', colors.border);
    root.style.setProperty('--theme-success', colors.success);
    root.style.setProperty('--theme-warning', colors.warning);
    root.style.setProperty('--theme-error', colors.error);

    // Also apply to color properties for admin UI
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-bg-primary', colors.background);
    root.style.setProperty('--color-bg-secondary', colors.surface);
    root.style.setProperty('--color-text-primary', colors.text);
    root.style.setProperty('--color-text-secondary', colors.textSecondary);
    root.style.setProperty('--color-border-primary', colors.border);

    // Update theme mode attribute
    root.setAttribute('data-theme', theme.mode);
  }

  async function clearThemePreview(): Promise<void> {
    const root = document.documentElement;

    // Remove preview-specific properties to restore defaults
    root.style.removeProperty('--theme-primary');
    root.style.removeProperty('--theme-secondary');
    root.style.removeProperty('--theme-accent');
    root.style.removeProperty('--theme-background');
    root.style.removeProperty('--theme-surface');
    root.style.removeProperty('--theme-text');
    root.style.removeProperty('--theme-text-secondary');
    root.style.removeProperty('--theme-border');
    root.style.removeProperty('--theme-success');
    root.style.removeProperty('--theme-warning');
    root.style.removeProperty('--theme-error');

    // Also clear admin UI color overrides
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-bg-primary');
    root.style.removeProperty('--color-bg-secondary');
    root.style.removeProperty('--color-text-primary');
    root.style.removeProperty('--color-text-secondary');
    root.style.removeProperty('--color-border-primary');

    // Restore original theme mode
    const systemTheme =
      $themeStore === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : $themeStore;
    root.setAttribute('data-theme', systemTheme);

    // Reload the active theme colors from server to restore them
    await themeStore.reloadThemeColors();
  }

  function revertChanges(): void {
    if (originalThemeSnapshot) {
      editingTheme = { ...originalThemeSnapshot, colors: { ...originalThemeSnapshot.colors } };
      toastStore.info('Changes reverted');
    }
  }

  function closeEditor(): void {
    showEditor = false;
    editingTheme = null;
    originalThemeSnapshot = null;

    // Clear preview when closing editor
    if (currentlyViewingTheme) {
      const theme = themes.find((t) => t.id === currentlyViewingTheme);
      if (theme) {
        applyThemePreview(currentlyViewingTheme);
      }
    } else {
      clearThemePreview();
    }
  }

  // Drag and drop handlers
  function handleDragStart(event: DragEvent, index: number): void {
    // Prevent dragging current system themes
    const theme = filteredThemes[index];
    const isCurrentSystemTheme = theme.id === systemLightTheme || theme.id === systemDarkTheme;
    if (isCurrentSystemTheme) {
      event.preventDefault();
      return;
    }
    draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', '');
    }
  }

  function handleDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverIndex = index;
  }

  function handleDragLeave(): void {
    dragOverIndex = null;
  }

  function handleDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      draggedIndex = null;
      dragOverIndex = null;
      return;
    }

    // Prevent dropping on or before current system themes
    const dropTheme = filteredThemes[dropIndex];
    const isDropOnSystemTheme =
      dropTheme.id === systemLightTheme || dropTheme.id === systemDarkTheme;
    if (isDropOnSystemTheme) {
      draggedIndex = null;
      dragOverIndex = null;
      return;
    }

    // Reorder within filtered themes
    const reordered = [...filteredThemes];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, removed);

    // Ensure current system themes stay at the top after reordering
    const currentSystemThemes = reordered.filter(
      (t) => t.id === systemLightTheme || t.id === systemDarkTheme
    );
    const otherThemes = reordered.filter(
      (t) => t.id !== systemLightTheme && t.id !== systemDarkTheme
    );
    // Sort system themes: light first, then dark
    currentSystemThemes.sort((a, b) => {
      if (a.id === systemLightTheme) return -1;
      if (b.id === systemLightTheme) return 1;
      return 0;
    });
    const finalOrdered = [...currentSystemThemes, ...otherThemes];

    // Update full themes array
    if (filterMode === 'all') {
      themes = finalOrdered;
    } else {
      // Preserve other mode themes and insert reordered ones
      const themesInOtherModes = themes.filter((t) => t.mode !== filterMode);
      themes = [...finalOrdered, ...themesInOtherModes];
    }

    // Save the new order
    saveThemeOrderToAPI(themes.map((t) => t.id));

    draggedIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd(): void {
    draggedIndex = null;
    dragOverIndex = null;
  }

  async function saveThemeOrderToAPI(themeIds: string[]): Promise<void> {
    try {
      const response = await fetch('/api/color-themes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeIds })
      });

      if (!response.ok) throw new Error('Failed to save theme order');
      toastStore.success('Theme order saved');
    } catch (error) {
      console.error('Error saving theme order:', error);
      toastStore.error('Failed to save theme order');
    }
  }

  function isSystemTheme(themeId: string): boolean {
    return themeId === systemLightTheme || themeId === systemDarkTheme;
  }

  function isCurrentlyViewing(themeId: string): boolean {
    return themeId === currentlyViewingTheme;
  }

  function getSystemLabel(theme: ColorThemeDefinition): string | null {
    if (theme.id === systemLightTheme) return 'System Light';
    if (theme.id === systemDarkTheme) return 'System Dark';
    return null;
  }
</script>

<div class="theme-manager">
  {#if loading}
    <div class="loading-state">
      <p>Loading themes...</p>
    </div>
  {:else}
    <div class="header">
      <div>
        <h1>Color Themes</h1>
        <p class="subtitle">
          Drag to reorder • Set system defaults for light/dark • Preview themes
        </p>
      </div>
      <div class="header-actions">
        <button type="button" class="btn-secondary" on:click={() => createNewTheme('light')}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          New Light Theme
        </button>
        <button type="button" class="btn-primary" on:click={() => createNewTheme('dark')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          New Dark Theme
        </button>
      </div>
    </div>

    <div class="active-themes-banner">
      <div class="active-theme-item">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <span class="active-label">System Light:</span>
        <span class="active-name"
          >{lightThemes.find((t) => t.id === systemLightTheme)?.name || 'Default Light'}</span
        >
      </div>
      <div class="active-theme-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="active-label">System Dark:</span>
        <span class="active-name"
          >{darkThemes.find((t) => t.id === systemDarkTheme)?.name || 'Default Dark'}</span
        >
      </div>
      {#if currentlyViewingTheme}
        <div class="active-theme-item currently-viewing">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="2" />
            <circle cx="12" cy="12" r="3" stroke-width="2" />
          </svg>
          <span class="active-label">Currently Viewing:</span>
          <span class="active-name"
            >{themes.find((t) => t.id === currentlyViewingTheme)?.name || 'Unknown'}</span
          >
          <button
            type="button"
            class="clear-viewing-btn"
            on:click={() => {
              setCurrentlyViewingTheme(null);
              currentlyViewingTheme = null;
              clearThemePreview();
              toastStore.info('Preview disabled');
            }}
            title="Clear currently viewing"
          >
            ×
          </button>
        </div>
      {/if}
    </div>

    <div class="filters">
      <button
        type="button"
        class="filter-btn"
        class:active={filterMode === 'all'}
        on:click={() => (filterMode = 'all')}
      >
        All Themes ({themes.length})
      </button>
      <button
        type="button"
        class="filter-btn"
        class:active={filterMode === 'light'}
        on:click={() => (filterMode = 'light')}
      >
        Light ({themes.filter((t) => t.mode === 'light').length})
      </button>
      <button
        type="button"
        class="filter-btn"
        class:active={filterMode === 'dark'}
        on:click={() => (filterMode = 'dark')}
      >
        Dark ({themes.filter((t) => t.mode === 'dark').length})
      </button>
    </div>

    <div class="themes-list">
      {#each filteredThemes as theme, index (theme.id)}
        <div
          class="theme-row"
          class:system={isSystemTheme(theme.id)}
          class:currently-viewing={isCurrentlyViewing(theme.id)}
          class:dragging={draggedIndex === index}
          class:drag-over={dragOverIndex === index}
          class:not-draggable={theme.id === systemLightTheme ||
            theme.id === systemDarkTheme ||
            filterMode !== 'all'}
          draggable={theme.id !== systemLightTheme &&
            theme.id !== systemDarkTheme &&
            filterMode === 'all'}
          role="button"
          tabindex="0"
          on:dragstart={(e) => handleDragStart(e, index)}
          on:dragover={(e) => handleDragOver(e, index)}
          on:dragleave={handleDragLeave}
          on:drop={(e) => handleDrop(e, index)}
          on:dragend={handleDragEnd}
        >
          {#if theme.id !== systemLightTheme && theme.id !== systemDarkTheme && filterMode === 'all'}
            <div class="drag-handle" title="Drag to reorder">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="5" r="1.5" />
                <circle cx="15" cy="5" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="19" r="1.5" />
                <circle cx="15" cy="19" r="1.5" />
              </svg>
            </div>
          {/if}

          <div class="theme-info">
            <div class="theme-name-badges">
              <h3>{theme.name}</h3>
              <div class="badges">
                {#if getSystemLabel(theme)}
                  <span class="badge system-badge">⚙ {getSystemLabel(theme)}</span>
                {/if}
                <span class="badge mode-badge" class:dark={theme.mode === 'dark'}>{theme.mode}</span
                >
              </div>
            </div>
          </div>

          <div class="theme-actions">
            <button
              type="button"
              class="action-btn preview-btn"
              class:active={theme.id === activeThemeId}
              style:background={theme.id === activeThemeId ? theme.colors.primary : ''}
              style:border-color={theme.id === activeThemeId ? theme.colors.primary : ''}
              style:color={theme.id === activeThemeId ? 'white' : ''}
              on:click={() => togglePreview(theme.id)}
              title={theme.id === activeThemeId && currentlyViewingTheme
                ? 'Stop previewing'
                : theme.id === activeThemeId
                  ? 'Currently active'
                  : 'Preview on site'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="2" />
                <circle cx="12" cy="12" r="3" stroke-width="2" />
              </svg>
            </button>

            {#if theme.id !== systemLightTheme && theme.id !== systemDarkTheme}
              <button
                type="button"
                class="action-btn icon-btn danger"
                on:click={() => deleteTheme(theme.id)}
                title="Delete"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                    stroke-width="2"
                  />
                </svg>
              </button>
            {/if}
          </div>

          <div class="color-dots">
            <div class="color-dot" style="background: {theme.colors.primary}" title="Primary"></div>
            <div
              class="color-dot"
              style="background: {theme.colors.secondary}"
              title="Secondary"
            ></div>
            <div class="color-dot" style="background: {theme.colors.accent}" title="Accent"></div>
            <div
              class="color-dot"
              style="background: {theme.colors.background}"
              title="Background"
            ></div>
            <div class="color-dot" style="background: {theme.colors.text}" title="Text"></div>
          </div>

          <button
            type="button"
            class="action-btn icon-btn settings-btn"
            on:click={() => editTheme(theme)}
            title={theme.isSystem ? 'View theme' : 'Edit theme settings'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showEditor && editingTheme}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="modal-overlay"
    on:click={closeEditor}
    on:keydown={(e) => e.key === 'Escape' && closeEditor()}
  >
    <div class="modal" on:click|stopPropagation on:keydown|stopPropagation>
      <div class="modal-header">
        <h2>Edit Theme</h2>
        {#if hasUnsavedChanges}
          <span class="unsaved-badge">Unsaved Changes</span>
        {/if}
        <button type="button" class="close-btn" on:click={closeEditor}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <input
          type="text"
          bind:value={editingTheme.name}
          placeholder="Theme Name"
          class="theme-name-input"
        />

        <div class="color-sections">
          <div class="color-section">
            <h4>Focal Colors</h4>
            <div class="color-row">
              <span class="color-label">Primary</span>
              <div class="color-input-group">
                <input
                  type="color"
                  bind:value={editingTheme.colors.primary}
                  on:change={() =>
                    editingTheme &&
                    colorHarmonyMode !== 'none' &&
                    applyColorHarmony(editingTheme.colors.primary, colorHarmonyMode)}
                />
                <input type="text" bind:value={editingTheme.colors.primary} class="hex-input" />
              </div>
            </div>
            <div class="color-row">
              <span class="color-label">Secondary</span>
              <div class="color-input-group">
                <input type="color" bind:value={editingTheme.colors.secondary} />
                <input type="text" bind:value={editingTheme.colors.secondary} class="hex-input" />
              </div>
            </div>
            <div class="color-row">
              <span class="color-label">Accent</span>
              <div class="color-input-group">
                <input type="color" bind:value={editingTheme.colors.accent} />
                <input type="text" bind:value={editingTheme.colors.accent} class="hex-input" />
              </div>
            </div>

            <div class="harmony-controls">
              <button
                type="button"
                class="harmony-header"
                on:click={() => {
                  isHarmonyExpanded = !isHarmonyExpanded;
                }}
              >
                <span class="harmony-label">Color Harmony</span>
                <span class="collapse-icon">{isHarmonyExpanded ? '▼' : '▶'}</span>
              </button>

              {#if isHarmonyExpanded}
                <div class="harmony-content">
                  <div class="harmony-buttons">
                    <button
                      type="button"
                      class="harmony-btn"
                      class:active={colorHarmonyMode === 'none'}
                      on:click={() => {
                        colorHarmonyMode = 'none';
                      }}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      class="harmony-btn"
                      class:active={colorHarmonyMode === 'complementary'}
                      on:click={() => {
                        if (editingTheme) {
                          colorHarmonyMode = 'complementary';
                          applyColorHarmony(editingTheme.colors.primary, 'complementary');
                        }
                      }}
                    >
                      Complementary
                    </button>
                    <button
                      type="button"
                      class="harmony-btn"
                      class:active={colorHarmonyMode === 'triadic'}
                      on:click={() => {
                        if (editingTheme) {
                          colorHarmonyMode = 'triadic';
                          applyColorHarmony(editingTheme.colors.primary, 'triadic');
                        }
                      }}
                    >
                      Triadic
                    </button>
                    <button
                      type="button"
                      class="harmony-btn"
                      class:active={colorHarmonyMode === 'analogous'}
                      on:click={() => {
                        if (editingTheme) {
                          colorHarmonyMode = 'analogous';
                          applyColorHarmony(editingTheme.colors.primary, 'analogous');
                        }
                      }}
                    >
                      Analogous
                    </button>
                    <button
                      type="button"
                      class="harmony-btn"
                      class:active={colorHarmonyMode === 'split'}
                      on:click={() => {
                        if (editingTheme) {
                          colorHarmonyMode = 'split';
                          applyColorHarmony(editingTheme.colors.primary, 'split');
                        }
                      }}
                    >
                      Split Comp
                    </button>
                    <button
                      type="button"
                      class="harmony-btn"
                      class:active={colorHarmonyMode === 'tetradic'}
                      on:click={() => {
                        if (editingTheme) {
                          colorHarmonyMode = 'tetradic';
                          applyColorHarmony(editingTheme.colors.primary, 'tetradic');
                        }
                      }}
                    >
                      Tetradic
                    </button>
                    <button
                      type="button"
                      class="harmony-btn"
                      class:active={colorHarmonyMode === 'monochromatic'}
                      on:click={() => {
                        if (editingTheme) {
                          colorHarmonyMode = 'monochromatic';
                          applyColorHarmony(editingTheme.colors.primary, 'monochromatic');
                        }
                      }}
                    >
                      Monochrome
                    </button>
                    <button
                      type="button"
                      class="harmony-btn"
                      class:active={colorHarmonyMode === 'double-split'}
                      on:click={() => {
                        if (editingTheme) {
                          colorHarmonyMode = 'double-split';
                          applyColorHarmony(editingTheme.colors.primary, 'double-split');
                        }
                      }}
                    >
                      Double Split
                    </button>
                  </div>

                  <div class="brightness-control">
                    <label for="wheel-brightness">
                      <span class="brightness-label">Brightness</span>
                      <span class="brightness-value">{wheelBrightness}%</span>
                    </label>
                    <input
                      id="wheel-brightness"
                      type="range"
                      min="0"
                      max="80"
                      bind:value={wheelBrightness}
                      on:input={() => {
                        drawColorWheel();
                      }}
                      class="brightness-slider"
                    />
                  </div>

                  <div class="color-wheel-container">
                    <canvas
                      bind:this={colorWheelCanvas}
                      width="280"
                      height="280"
                      class="color-wheel"
                      on:mousedown={handleWheelMouseDown}
                      on:mousemove={handleWheelMouseMove}
                      on:mouseup={handleWheelMouseUp}
                      on:mouseleave={handleWheelMouseLeave}
                    ></canvas>
                    <div class="wheel-description">
                      {#if colorHarmonyMode === 'none'}
                        <p>
                          Select a harmony mode to lock colors together based on professional color
                          theory.
                        </p>
                      {:else if colorHarmonyMode === 'complementary'}
                        <p>
                          <strong>Complementary:</strong> Primary + opposite complement with subtle accent
                          variation. Creates maximum contrast and visual tension. Perfect for bold, attention-grabbing
                          designs.
                        </p>
                      {:else if colorHarmonyMode === 'triadic'}
                        <p>
                          <strong>Triadic:</strong> Three colors equally spaced (120°) create balanced
                          vibrancy. Offers visual diversity while maintaining harmony. Ideal for playful,
                          energetic themes.
                        </p>
                      {:else if colorHarmonyMode === 'tetradic'}
                        <p>
                          <strong>Tetradic (Square):</strong> Primary + complement with balanced intermediates
                          (90°). Rich, sophisticated palette with strong contrast. Best for complex, multi-layered
                          designs.
                        </p>
                      {:else if colorHarmonyMode === 'analogous'}
                        <p>
                          <strong>Analogous:</strong> Adjacent colors (±25°) with subtle brightness variations.
                          Creates serene, harmonious flow. Perfect for calm, cohesive, nature-inspired
                          themes.
                        </p>
                      {:else if colorHarmonyMode === 'split'}
                        <p>
                          <strong>Split Complementary:</strong> Primary + two colors flanking its complement
                          (150°/210°). Softer contrast than complementary. Great balance of tension and
                          harmony.
                        </p>
                      {:else if colorHarmonyMode === 'monochromatic'}
                        <p>
                          <strong>Monochromatic:</strong> Single hue with varied saturation and brightness.
                          Creates sophisticated, unified look with depth. Excellent for elegant, minimalist
                          designs.
                        </p>
                      {:else if colorHarmonyMode === 'double-split'}
                        <p>
                          <strong>Double Split:</strong> Advanced palette with primary + dual split complements
                          (135°/225°). Complex, rich color relationships. For sophisticated, high-impact
                          professional themes.
                        </p>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <div class="color-section">
            <h4>Backgrounds</h4>
            <div class="color-row">
              <span class="color-label">Background</span>
              <div class="color-input-group">
                <input type="color" bind:value={editingTheme.colors.background} />
                <input type="text" bind:value={editingTheme.colors.background} class="hex-input" />
              </div>
            </div>
            <div class="color-row">
              <span class="color-label">Surface</span>
              <div class="color-input-group">
                <input type="color" bind:value={editingTheme.colors.surface} />
                <input type="text" bind:value={editingTheme.colors.surface} class="hex-input" />
              </div>
            </div>
          </div>

          <div class="color-section">
            <h4>Text & Borders</h4>
            <div class="color-row">
              <span class="color-label">Text</span>
              <div class="color-input-group">
                <input type="color" bind:value={editingTheme.colors.text} />
                <input type="text" bind:value={editingTheme.colors.text} class="hex-input" />
              </div>
            </div>
            <div class="color-row">
              <span class="color-label">Text Secondary</span>
              <div class="color-input-group">
                <input type="color" bind:value={editingTheme.colors.textSecondary} />
                <input
                  type="text"
                  bind:value={editingTheme.colors.textSecondary}
                  class="hex-input"
                />
              </div>
            </div>
            <div class="color-row">
              <span class="color-label">Border</span>
              <div class="color-input-group">
                <input type="color" bind:value={editingTheme.colors.border} />
                <input type="text" bind:value={editingTheme.colors.border} class="hex-input" />
              </div>
            </div>
          </div>

          <div class="color-section">
            <h4>Status Colors</h4>
            <div class="color-row">
              <span class="color-label">Success</span>
              <div class="color-input-group">
                <input type="color" bind:value={editingTheme.colors.success} />
                <input type="text" bind:value={editingTheme.colors.success} class="hex-input" />
              </div>
            </div>
            <div class="color-row">
              <span class="color-label">Warning</span>
              <div class="color-input-group">
                <input type="color" bind:value={editingTheme.colors.warning} />
                <input type="text" bind:value={editingTheme.colors.warning} class="hex-input" />
              </div>
            </div>
            <div class="color-row">
              <span class="color-label">Error</span>
              <div class="color-input-group">
                <input type="color" bind:value={editingTheme.colors.error} />
                <input type="text" bind:value={editingTheme.colors.error} class="hex-input" />
              </div>
            </div>
          </div>
        </div>

        <div class="preview-section">
          <h4>Preview</h4>
          <div class="preview-box" style={generateThemeStyles(editingTheme.colors)}>
            <div
              style="background: var(--theme-primary); color: var(--theme-background); padding: 1rem; border-radius: 4px; margin-bottom: 0.5rem;"
            >
              Primary Color
            </div>
            <div
              style="background: var(--theme-surface); color: var(--theme-text); padding: 1rem; border: 1px solid var(--theme-border); border-radius: 4px;"
            >
              <strong style="color: var(--theme-text);">Surface with Text</strong>
              <p style="color: var(--theme-text-secondary); margin: 0.5rem 0 0 0;">
                Secondary text color
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div class="footer-left">
          <button type="button" class="btn-secondary" on:click={closeEditor}>
            {hasUnsavedChanges ? 'Close Without Saving' : 'Close'}
          </button>
          {#if hasUnsavedChanges && originalThemeSnapshot !== null}
            <button type="button" class="btn-warning" on:click={revertChanges}>
              Revert Changes
            </button>
          {/if}
        </div>
        <div class="footer-right">
          {#if originalThemeSnapshot !== null}
            <button
              type="button"
              class="btn-secondary"
              disabled={editingTheme.mode === 'light'
                ? systemLightTheme === editingTheme.id
                : systemDarkTheme === editingTheme.id}
              on:click={() => editingTheme && setSystemDefault(editingTheme.id, editingTheme.mode)}
            >
              {editingTheme.mode === 'light'
                ? systemLightTheme === editingTheme.id
                  ? '✓ Current System Light'
                  : 'Set as System Light'
                : systemDarkTheme === editingTheme.id
                  ? '✓ Current System Dark'
                  : 'Set as System Dark'}
            </button>
          {/if}
          <button
            type="button"
            class="btn-primary"
            on:click={saveTheme}
            disabled={!hasUnsavedChanges}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .theme-manager {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--color-text-primary);
  }

  .subtitle {
    margin: 0.5rem 0 0 0;
    color: var(--color-text-secondary);
    font-size: 0.95rem;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
  }

  .active-themes-banner {
    display: flex;
    gap: 2rem;
    padding: 1.5rem;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border-primary);
    border-radius: 8px;
    color: var(--color-text-primary);
    margin-bottom: 1.5rem;
  }

  .active-theme-item.currently-viewing {
    background: var(--color-bg-tertiary);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid var(--color-border-secondary);
  }

  .clear-viewing-btn {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-secondary);
    color: var(--color-text-primary);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    font-weight: bold;
    transition: all 0.2s;
  }

  .clear-viewing-btn:hover {
    background: var(--color-danger);
    border-color: var(--color-danger);
    color: white;
  }

  .active-theme-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--color-text-primary);
    font-size: 0.95rem;
  }

  .active-theme-item svg {
    flex-shrink: 0;
  }

  .active-label {
    font-weight: 600;
    opacity: 0.9;
  }

  .active-name {
    font-weight: 700;
    font-size: 1.05rem;
  }

  .filters {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .filter-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    color: var(--color-text-secondary);
    transition: all 0.2s;
  }

  .filter-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .filter-btn.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .themes-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .theme-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--color-bg-primary);
    border: 2px solid var(--color-border-secondary);
    border-radius: 8px;
    transition: all 0.2s;
    cursor: grab;
  }

  .theme-row:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .theme-row.system {
    border-color: var(--color-success);
    background: linear-gradient(
      to right,
      rgba(16, 185, 129, 0.05) 0%,
      var(--color-bg-primary) 12px
    );
  }

  .theme-row.currently-viewing {
    border-color: var(--color-primary);
    background: linear-gradient(
      to right,
      rgba(59, 130, 246, 0.08) 0%,
      var(--color-bg-primary) 12px
    );
  }

  .theme-row.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  .theme-row.drag-over {
    border-color: var(--color-primary);
    border-style: dashed;
    transform: translateY(-2px);
    background: rgba(59, 130, 246, 0.02);
  }

  .drag-handle {
    display: flex;
    align-items: center;
    color: var(--color-text-secondary);
    cursor: grab;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .theme-row:hover .drag-handle {
    opacity: 1;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .theme-row.not-draggable {
    cursor: default;
  }

  .theme-row.not-draggable .drag-handle {
    cursor: not-allowed;
    opacity: 0.2;
  }

  .theme-row.not-draggable:hover .drag-handle {
    opacity: 0.3;
  }

  .theme-info {
    flex: 1;
    min-width: 0;
  }

  .theme-name-badges {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .theme-name-badges h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .badge {
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }

  .system-badge {
    background: var(--color-success);
    color: white;
  }

  .mode-badge {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    color: var(--color-text-secondary);
  }

  .mode-badge.dark {
    background: var(--color-text-primary);
    color: var(--color-bg-primary);
    border-color: var(--color-text-primary);
  }

  .color-dots {
    display: flex;
    gap: 0.5rem;
  }

  .color-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid var(--color-border-primary);
    box-shadow: 0 1px 3px var(--color-shadow-sm, rgba(0, 0, 0, 0.1));
  }

  .theme-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: all 0.2s;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--color-bg-secondary);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .action-btn.preview-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-bg-secondary);
  }

  .action-btn.preview-btn.active {
    border-color: var(--color-primary);
    color: white;
    background: var(--color-primary);
  }

  .action-btn.preview-btn.active:hover {
    opacity: 0.9;
  }

  .action-btn.icon-btn {
    padding: 0.5rem;
  }

  .action-btn.danger:hover {
    border-color: var(--color-danger);
    color: var(--color-danger);
    background: transparent;
  }

  .btn-primary,
  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--color-warning, #f59e0b);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-warning:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    color: var(--color-text-primary);
  }

  .btn-secondary:hover {
    background: var(--color-bg-tertiary);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--color-bg-primary);
    border-radius: 8px;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border-secondary);
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .unsaved-badge {
    padding: 0.375rem 0.75rem;
    background: var(--color-warning, #f59e0b);
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .close-btn {
    padding: 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .theme-name-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1.125rem;
    font-weight: 600;
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .harmony-controls {
    margin-bottom: 2rem;
    background: var(--color-bg-secondary);
    border-radius: 8px;
  }

  .harmony-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    margin: 0;
    background: none;
    /* Inherit, or the global filled-button colour makes this unreadable. */
    color: inherit;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .harmony-header:hover {
    background: var(--color-bg-hover, rgba(0, 0, 0, 0.05));
  }

  .harmony-label {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .collapse-icon {
    font-size: 1rem;
    color: var(--color-text-secondary);
    transition: transform 0.2s;
  }

  .harmony-content {
    padding: 0 1.5rem 1.5rem 1.5rem;
  }

  .harmony-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .harmony-btn {
    padding: 0.5rem 1rem;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    transition: all 0.2s;
  }

  .harmony-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .harmony-btn.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .brightness-control {
    margin-top: 1.5rem;
    margin-bottom: 1rem;
  }

  .brightness-control label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .brightness-label {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .brightness-value {
    font-weight: 600;
    color: var(--color-primary);
    font-size: 0.875rem;
  }

  .brightness-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--color-bg-secondary);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .brightness-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-primary);
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s;
  }

  .brightness-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  .brightness-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-primary);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s;
  }

  .brightness-slider::-moz-range-thumb:hover {
    transform: scale(1.1);
  }

  .color-wheel-container {
    display: flex;
    gap: 2rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .color-wheel {
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .wheel-description {
    flex: 1;
    min-width: 250px;
    max-width: 300px;
  }

  .wheel-description p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .wheel-description strong {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .color-sections {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .color-section h4 {
    margin: 0 0 1rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .color-label {
    min-width: 120px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .color-input-group {
    display: flex;
    gap: 0.75rem;
    flex: 1;
  }

  .color-input-group input[type='color'] {
    width: 60px;
    height: 40px;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    cursor: pointer;
  }

  .hex-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    font-family: monospace;
    font-size: 0.875rem;
  }

  .preview-section {
    margin-top: 2rem;
  }

  .preview-section h4 {
    margin: 0 0 1rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .preview-box {
    padding: 1.5rem;
    background: var(--theme-background);
    border: 1px solid var(--theme-border);
    border-radius: 8px;
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--color-border-secondary);
    flex-wrap: wrap;
  }

  .footer-left,
  .footer-right {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    .theme-manager {
      padding: 1rem;
    }

    .header {
      flex-direction: column;
      gap: 1rem;
    }

    .header-actions {
      width: 100%;
      flex-direction: column;
    }

    .active-themes-banner {
      flex-direction: column;
      gap: 0.75rem;
    }

    .theme-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .theme-name-badges {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .color-dots {
      align-self: flex-start;
    }

    .theme-actions {
      width: 100%;
      flex-wrap: wrap;
    }

    .modal {
      width: 95%;
      max-height: 95vh;
    }

    .color-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .color-label {
      min-width: auto;
    }

    .color-input-group {
      width: 100%;
    }

    .harmony-buttons {
      flex-direction: column;
    }

    .harmony-btn {
      width: 100%;
    }

    .color-wheel-container {
      flex-direction: column;
      gap: 1rem;
    }

    .color-wheel {
      width: 240px;
      height: 240px;
    }

    .wheel-description {
      max-width: 100%;
      text-align: center;
    }
  }
</style>
