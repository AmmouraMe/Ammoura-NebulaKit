# Responsive Design Guidelines

## Mobile-First Approach

Ammoura is built with a mobile-first responsive design philosophy. All components
and pages should be developed and tested for mobile devices first, then
progressively enhanced for larger screens.

## Breakpoints

We use the following standard breakpoints throughout the application:

```css
/* Mobile (default) */
/* 0px - 479px */

/* Small tablets and large phones */
@media (min-width: 480px) {
}

/* Tablets */
@media (min-width: 768px) {
}

/* Desktop */
@media (min-width: 968px) {
}

/* Large desktop */
@media (min-width: 1200px) {
}
```

### Mobile-Last Breakpoints

When using mobile-last approach (fixing desktop issues for mobile):

```css
/* Below tablet */
@media (max-width: 767px) {
}

/* Below desktop */
@media (max-width: 967px) {
}
```

## Core Responsive Principles

### 1. Prevent Text Overflow

**Always** apply these properties to text containers that might contain long
strings:

```css
.text-container {
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}
```

For single-line text that should truncate:

```css
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### 2. Flexible Buttons

Buttons should adapt to their content and container:

```css
button {
  white-space: normal; /* Allow text wrapping */
  text-align: center;
  min-height: 44px; /* iOS touch target minimum */
  padding: 0.5rem 1rem;
}

/* Full-width buttons on mobile */
@media (max-width: 768px) {
  .btn-mobile-full {
    width: 100%;
  }
}
```

### 3. Touch Targets

All interactive elements must meet minimum touch target sizes:

```css
/* Minimum 44x44px for iOS, 48x48px for Android */
button,
a,
input[type='checkbox'],
input[type='radio'] {
  min-height: 44px;
  min-width: 44px;
}
```

### 4. Responsive Grid Layouts

Use CSS Grid with mobile-first columns:

```css
.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr; /* Mobile: single column */
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, 1fr); /* Tablet: 2 columns */
  }
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr); /* Desktop: 3 columns */
  }
}
```

### 5. Responsive Typography

Use `clamp()` for fluid typography:

```css
h1 {
  font-size: clamp(2rem, 5vw, 3.5rem);
}

h2 {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
}

p {
  font-size: clamp(0.875rem, 1.5vw, 1rem);
}
```

### 6. Flexible Images

Images should always be responsive:

```css
img {
  max-width: 100%;
  height: auto;
  display: block;
}
```

### 7. Horizontal Scrolling Prevention

Prevent horizontal overflow:

```css
body {
  overflow-x: hidden;
  width: 100%;
}

* {
  box-sizing: border-box;
}
```

## Component-Specific Guidelines

### Navigation

- Mobile: Hamburger menu with slide-out drawer
- Desktop: Full horizontal navigation

```svelte
<nav>
  <div class="mobile-menu-toggle">☰</div>
  <div class="nav-links desktop-only">
    <!-- Links -->
  </div>
</nav>

<style>
  .mobile-menu-toggle {
    display: block;
  }

  .nav-links {
    display: none;
  }

  @media (min-width: 768px) {
    .mobile-menu-toggle {
      display: none;
    }

    .nav-links {
      display: flex;
    }
  }
</style>
```

### Forms

- Stack labels above inputs on mobile
- Side-by-side on desktop for short inputs
- Full-width inputs on mobile

```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (min-width: 768px) {
  .form-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}
```

### Tables

Tables should be scrollable on mobile:

```css
.table-container {
  width: 100%;
  overflow-x: auto;
}

table {
  min-width: 600px; /* Prevent cramping */
}

@media (min-width: 768px) {
  table {
    min-width: 100%;
  }
}
```

Alternative: Convert to card layout on mobile:

```css
@media (max-width: 767px) {
  table,
  thead,
  tbody,
  th,
  td,
  tr {
    display: block;
  }

  thead {
    display: none;
  }

  tr {
    margin-bottom: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }
}
```

### Cards & Grid Items

Product cards and similar components:

```css
.card-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr; /* Mobile: 1 column */
}

@media (min-width: 640px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr); /* Tablet: 2 columns */
  }
}

@media (min-width: 1024px) {
  .card-grid {
    grid-template-columns: repeat(3, 1fr); /* Desktop: 3 columns */
  }
}
```

## Testing Checklist

Before committing responsive changes, test:

- [ ] iPhone SE (375px width) - smallest common mobile
- [ ] iPhone 12/13/14 (390px width)
- [ ] iPad (768px width)
- [ ] Desktop (1200px+ width)
- [ ] Text doesn't overflow containers
- [ ] Buttons are tappable (44px minimum)
- [ ] Forms are usable without zooming
- [ ] Navigation works on all screen sizes
- [ ] Tables don't cause horizontal scrolling
- [ ] Images scale properly
- [ ] Content is readable without zooming

## Common Pitfalls to Avoid

### ❌ Fixed Widths

```css
/* Bad */
.container {
  width: 600px;
}

/* Good */
.container {
  width: 100%;
  max-width: 600px;
}
```

### ❌ Absolute Font Sizes

```css
/* Bad */
p {
  font-size: 14px;
}

/* Good */
p {
  font-size: clamp(0.875rem, 1.5vw, 1rem);
}
```

### ❌ Long Text Without Wrapping

```css
/* Bad */
.button {
  white-space: nowrap;
}

/* Good */
.button {
  white-space: normal;
  word-wrap: break-word;
}
```

### ❌ Tiny Touch Targets

```css
/* Bad */
button {
  padding: 2px 8px;
}

/* Good */
button {
  padding: 0.75rem 1.5rem;
  min-height: 44px;
}
```

## iOS-Specific Fixes

### Prevent Zoom on Input Focus

```css
@media screen and (max-width: 768px) {
  input,
  select,
  textarea {
    font-size: 16px; /* Prevents auto-zoom */
  }
}
```

### Safe Area Insets (for notched devices)

```css
.container {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

## Utility Classes

Use these global utility classes defined in `app.css`:

```html
<!-- Hide/Show based on screen size -->
<div class="mobile-only">Only visible on mobile</div>
<div class="desktop-only">Only visible on desktop</div>

<!-- Responsive containers -->
<div class="container">Centered, responsive container</div>

<!-- Responsive grids -->
<div class="grid grid-sm-2 grid-md-3 grid-lg-4">
  <!-- Auto-responsive grid items -->
</div>
```

## Resources

- [MDN: Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/WCAG21/quickref/)
- [iOS Human Interface Guidelines - Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Material Design - Layout](https://m3.material.io/foundations/layout/understanding-layout/overview)

## Maintenance

This document should be updated whenever:

- New breakpoints are introduced
- Common responsive patterns emerge
- Team discovers new best practices
- Mobile issues are identified and resolved
