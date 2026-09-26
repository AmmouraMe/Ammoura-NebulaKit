<script lang="ts">
  import { DEFAULT_STORE_NAME } from '$lib/branding';
  import ProductCard from '../lib/components/ProductCard.svelte';
  import FrontendComponentRenderer from '$lib/components/FrontendComponentRenderer.svelte';
  import { buildComponentTree } from '$lib/utils/componentTree';
  import { themeRefToCssVar } from '$lib/utils/editor/colorThemes';
  import { themeStore } from '$lib/stores/theme';
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { browser } from '$app/environment';
  import type { PageData } from './$types';
  import type { PageProperties } from '$lib/types/pages';

  export let data: PageData;
  const products = data.products;
  const page = data.page ?? null;
  const components = buildComponentTree(data.components ?? []);
  const pageProperties: PageProperties | undefined = data.pageProperties;
  const _isAdmin = data.isAdmin ?? false;
  const systemLightTheme = data.systemLightTheme ?? 'vibrant';
  const systemDarkTheme = data.systemDarkTheme ?? 'midnight';

  // Resolve a color value that may be a theme reference (e.g., 'theme:primary') to a CSS value
  function resolveColorValue(value: string | undefined): string | undefined {
    if (!value) return undefined;
    // Check if it's a theme or color reference
    const cssVar = themeRefToCssVar(value);
    if (cssVar) return cssVar;
    // Otherwise return the value as-is (it's a direct color value)
    return value;
  }

  let heroVisible = false;

  // Get the system's preferred color scheme
  function getSystemTheme(): 'light' | 'dark' {
    if (!browser) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Derive the applied theme mode from the theme preference (reactive to theme store changes)
  // When preference is 'system', use the OS preference
  $: appliedThemeMode =
    $themeStore === 'system' ? getSystemTheme() : ($themeStore as 'light' | 'dark');

  // The active color theme ID that matches the current light/dark mode (reactive)
  // If page has a specific colorTheme set, use that; otherwise use system theme
  $: colorTheme = data.colorTheme
    ? data.colorTheme
    : appliedThemeMode === 'dark'
      ? systemDarkTheme
      : systemLightTheme;

  onMount(() => {
    setTimeout(() => {
      heroVisible = true;
    }, 100);
  });

  $: features = [
    { icon: '🎯', title: $t('home.feature.setup'), description: $t('home.feature.setupDesc') },
    { icon: '✨', title: $t('home.feature.design'), description: $t('home.feature.designDesc') },
    {
      icon: '📦',
      title: $t('home.feature.products'),
      description: $t('home.feature.productsDesc')
    },
    {
      icon: '💳',
      title: $t('home.feature.payments'),
      description: $t('home.feature.paymentsDesc')
    },
    {
      icon: '🎨',
      title: $t('home.feature.customize'),
      description: $t('home.feature.customizeDesc')
    },
    { icon: '📱', title: $t('home.feature.mobile'), description: $t('home.feature.mobileDesc') }
  ];

  $: pricingFeatures = [
    $t('home.pricing.unlimitedProducts'),
    $t('home.pricing.freeDomain'),
    $t('home.pricing.aiBuilder'),
    $t('home.pricing.analytics'),
    $t('home.pricing.secureCheckout'),
    $t('home.pricing.videoGenerator')
  ];

  $: revenueShareTiers = [
    { range: '$0 – $1,000', fee: '8%', description: $t('home.tier.starting') },
    { range: '$1,001 – $5,000', fee: '6%', description: $t('home.tier.growing') },
    { range: '$5,001 – $20,000', fee: '4%', description: $t('home.tier.established') },
    { range: '$20,001+', fee: '3%', description: $t('home.tier.highVolume'), highlight: true }
  ];
</script>

<svelte:head>
  <title
    >{page
      ? page.title
      : `${data.storeName || DEFAULT_STORE_NAME} - ${$t('home.titleSuffix')}`}</title
  >
  <meta name="description" content={$t('home.metaDescription')} />
</svelte:head>

{#if page && components.length > 0}
  <!-- Render page with components using FrontendComponentRenderer for proper container/children support -->
  <div
    class="component-page"
    style:background-color={resolveColorValue(pageProperties?.backgroundColor)}
    style:background-image={pageProperties?.backgroundImage
      ? `url(${pageProperties.backgroundImage})`
      : undefined}
    style:min-height={pageProperties?.minHeight || undefined}
    style:padding={pageProperties?.padding || undefined}
    style:border-color={resolveColorValue(pageProperties?.borderColor)}
    style:border-width={pageProperties?.borderWidth ? `${pageProperties.borderWidth}px` : undefined}
    style:border-style={pageProperties?.borderStyle || undefined}
    style:border-radius={pageProperties?.borderRadius
      ? `${pageProperties.borderRadius}px`
      : undefined}
    style:box-shadow={pageProperties?.boxShadow || undefined}
  >
    {#each components as component}
      <div class="component-container" data-component-type={component.type}>
        <FrontendComponentRenderer
          type={component.type}
          config={component.config}
          {colorTheme}
          siteContext={data.siteContext}
          user={data.currentUser}
        />
      </div>
    {/each}
  </div>
{:else}
  <!-- Default home page content -->
  <div class="hero-background">
    <div class="gradient-orb orb-1"></div>
    <div class="gradient-orb orb-2"></div>
    <div class="gradient-orb orb-3"></div>
  </div>

  <section class="hero" class:visible={heroVisible}>
    <div class="hero-badge">
      <span class="badge-icon">✨</span>
      <span>{$t('home.badge')}</span>
    </div>

    <h1 class="hero-title">
      {$t('home.heroTitle')}
      <span class="gradient-text">{$t('home.heroTitleAccent')}</span>
    </h1>

    <p class="hero-subtitle">
      {$t('home.heroSubtitle')}
      <br />
      <strong>{$t('home.heroSubtitle2')}</strong>
    </p>

    <div class="hero-actions">
      <a href="#products" class="btn btn-primary">
        <span>{$t('home.seeExample')}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M5 12h14M12 5l7 7-7 7"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </a>
      <a href="/auth/login" class="btn btn-secondary">
        <span>{$t('home.startYourStore')}</span>
      </a>
    </div>

    <div class="hero-stats">
      <div class="stat">
        <div class="stat-value">{$t('home.stat.simple')}</div>
        <div class="stat-label">{$t('home.stat.setup')}</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat-value">{$t('home.stat.beautiful')}</div>
        <div class="stat-label">{$t('home.stat.design')}</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat-value">{$t('home.stat.your')}</div>
        <div class="stat-label">{$t('home.stat.brand')}</div>
      </div>
    </div>
  </section>

  <section class="features" id="features">
    <div class="section-header">
      <h2>{$t('home.featuresTitle')}</h2>
      <p>{$t('home.featuresSubtitle')}</p>
    </div>

    <div class="features-grid">
      {#each features as feature}
        <div class="feature-card">
          <div class="feature-icon">{feature.icon}</div>
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </div>
      {/each}
    </div>
  </section>

  <section class="pricing" id="pricing">
    <div class="section-header">
      <h2>🚀 {$t('home.pricingTitle', { storeName: data.storeName || DEFAULT_STORE_NAME })}</h2>
      <p class="pricing-tagline">{$t('home.pricingTagline')}</p>
      <p class="pricing-subtitle">{$t('home.pricingSubtitle')}</p>
    </div>

    <div class="pricing-container">
      <div class="pricing-model">
        <div class="model-header">
          <span class="model-icon">💰</span>
          <h3>{$t('home.payAsYouGrow')}</h3>
          <p>{$t('home.allFeaturesIncluded')}</p>
        </div>

        <ul class="features-list">
          {#each pricingFeatures as feature}
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M5 13l4 4L19 7"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>{feature}</span>
            </li>
          {/each}
        </ul>
      </div>

      <div class="revenue-share">
        <div class="revenue-header">
          <span class="revenue-icon">💎</span>
          <h3>{$t('home.revenueShare')}</h3>
        </div>

        <div class="revenue-table">
          <div class="table-header">
            <span>{$t('home.monthlySales')}</span>
            <span>{$t('home.transactionFee')}</span>
          </div>
          {#each revenueShareTiers as tier}
            <div class="table-row" class:highlight={tier.highlight}>
              <div class="tier-range">
                <span class="range-value">{tier.range}</span>
                <span class="range-description">{tier.description}</span>
              </div>
              <div class="tier-fee">{tier.fee}</div>
            </div>
          {/each}
          <div class="table-footer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M12 5v14M5 12l7 7 7-7"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div class="pricing-footer">
      <a href="/auth/login" class="btn btn-primary btn-large">
        <span>{$t('home.startYourStore')}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M5 12h14M12 5l7 7-7 7"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </a>
      <p class="pricing-note">{$t('home.pricingNote')}</p>
    </div>
  </section>

  <section class="products" id="products">
    <div class="section-header">
      <h2>{$t('home.exampleStore')}</h2>
      <p>{$t('home.exampleStoreSubtitle')}</p>
    </div>

    {#if products.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>{$t('home.noProductsYet')}</h3>
        <p>{$t('home.noProductsHelp')}</p>
        <a href="/admin/products" class="btn btn-primary">{$t('home.addFirstProduct')}</a>
      </div>
    {:else}
      <div class="product-grid">
        {#each products as product}
          <ProductCard {product} />
        {/each}
      </div>
    {/if}
  </section>

  <section class="cta-section">
    <div class="cta-content">
      <h2>{$t('home.ctaTitle')}</h2>
      <p>{$t('home.ctaSubtitle')}</p>
      <div class="cta-actions">
        <a href="/auth/login" class="btn btn-primary btn-lg">
          <span>{$t('home.createYourStore')}</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M5 12h14M12 5l7 7-7 7"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </a>
        <a
          href="https://github.com/AmmouraMe/Ammoura-NebulaKit"
          target="_blank"
          class="btn btn-secondary btn-lg"
        >
          {$t('home.learnMore')}
        </a>
      </div>
    </div>
  </section>
{/if}

<style>
  /* Component Page */
  .component-page {
    width: 100%;
    min-height: 100vh;
  }

  .component-container {
    width: 100%;
  }

  /* Hero Background Effects */
  .hero-background {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 600px;
    overflow: hidden;
    pointer-events: none;
    z-index: -100;
    background: linear-gradient(180deg, var(--color-bg-secondary) 0%, var(--color-bg-primary) 100%);
  }

  .gradient-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.3;
    animation: float 20s ease-in-out infinite;
  }

  .orb-1 {
    width: 400px;
    height: 400px;
    background: var(--color-primary);
    top: -200px;
    left: -100px;
    animation-delay: 0s;
  }

  .orb-2 {
    width: 300px;
    height: 300px;
    background: var(--color-secondary);
    top: -100px;
    right: -50px;
    animation-delay: 7s;
  }

  .orb-3 {
    width: 350px;
    height: 350px;
    background: var(--color-primary-light);
    top: 200px;
    right: 30%;
    animation-delay: 14s;
  }

  @keyframes float {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    33% {
      transform: translate(50px, -30px) scale(1.1);
    }
    66% {
      transform: translate(-30px, 50px) scale(0.9);
    }
  }

  /* Hero Section */
  .hero {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: 4rem 2rem;
    margin-bottom: 4rem;
    /* background: linear-gradient(
      135deg,
      var(--color-bg-secondary) 0%,
      var(--color-bg-primary) 50%,
      var(--color-bg-tertiary) 100%
    ); */
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.8s ease,
      transform 0.8s ease,
      background-color var(--transition-normal);
  }

  .hero.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-bg-accent);
    border: 1px solid var(--color-border-primary);
    border-radius: 50px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
    margin-bottom: 1.5rem;
    transition: all var(--transition-normal);
  }

  .badge-icon {
    font-size: 1.2rem;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
  }

  .hero-title {
    font-size: clamp(2.5rem, 8vw, 4.5rem);
    font-weight: 800;
    line-height: 1.1;
    color: var(--color-text-primary);
    margin: 0 0 1.5rem 0;
    transition: color var(--transition-normal);
  }

  .gradient-text {
    display: inline-block;
    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-subtitle {
    font-size: clamp(1rem, 2vw, 1.25rem);
    color: var(--color-text-secondary);
    max-width: 700px;
    margin: 0 auto 2.5rem;
    line-height: 1.6;
    transition: color var(--transition-normal);
  }

  .hero-subtitle strong {
    color: var(--color-primary);
    font-weight: 600;
  }

  .hero-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 3rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.75rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none;
    transition: all var(--transition-normal);
    cursor: pointer;
    border: none;
  }

  .btn-primary {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    box-shadow: 0 4px 12px var(--color-shadow-medium);
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px var(--color-shadow-dark);
  }

  .btn-secondary {
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    border: 2px solid var(--color-border-primary);
  }

  .btn-secondary:hover {
    background: var(--color-bg-accent);
    border-color: var(--color-primary);
  }

  .btn-lg {
    padding: 1.125rem 2rem;
    font-size: 1.125rem;
  }

  .hero-stats {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-divider {
    width: 1px;
    height: 40px;
    background: var(--color-border-secondary);
  }

  /* Features Section */
  .features {
    margin-bottom: 4rem;
  }

  .section-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .section-header h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 1rem 0;
    transition: color var(--transition-normal);
  }

  .section-header p {
    font-size: 1.125rem;
    color: var(--color-text-secondary);
    transition: color var(--transition-normal);
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .feature-card {
    background: var(--color-bg-primary);
    padding: 2rem;
    border-radius: 12px;
    border: 1px solid var(--color-border-secondary);
    transition: all var(--transition-normal);
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px var(--color-shadow-medium);
    border-color: var(--color-primary);
  }

  .feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .feature-card h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 0.75rem 0;
    transition: color var(--transition-normal);
  }

  .feature-card p {
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin: 0;
    transition: color var(--transition-normal);
  }

  /* Pricing Section */
  .pricing {
    margin-bottom: 4rem;
  }

  .pricing-tagline {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-primary);
    margin: 0.5rem 0 0.25rem 0;
  }

  .pricing-subtitle {
    font-size: 1.125rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .pricing-container {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    margin-bottom: 3rem;
  }

  @media (min-width: 768px) {
    .pricing-container {
      grid-template-columns: 400px 1fr;
    }
  }

  .pricing-model {
    background: var(--color-bg-primary);
    border: 2px solid var(--color-border-secondary);
    border-radius: 16px;
    padding: 2rem;
    transition: all var(--transition-normal);
  }

  .pricing-model:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px var(--color-shadow-medium);
    border-color: var(--color-primary);
  }

  .model-header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--color-border-secondary);
  }

  .model-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .model-header h3 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 0.5rem 0;
  }

  .model-header p {
    color: var(--color-text-secondary);
    font-size: 1rem;
    margin: 0;
  }

  .features-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .features-list li {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 0;
    color: var(--color-text-primary);
    font-size: 1rem;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .features-list li:last-child {
    border-bottom: none;
  }

  .features-list li svg {
    flex-shrink: 0;
    margin-top: 0.125rem;
    stroke: var(--color-success);
  }

  .revenue-share {
    background: var(--color-bg-primary);
    border: 2px solid var(--color-primary);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 8px 32px var(--color-shadow-medium);
    transition: all var(--transition-normal);
  }

  .revenue-share:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px var(--color-shadow-dark);
  }

  .revenue-header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--color-border-secondary);
  }

  .revenue-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .revenue-header h3 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .revenue-table {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .table-header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2rem;
    padding: 1rem 1.5rem;
    background: var(--color-bg-tertiary);
    border-radius: 8px 8px 0 0;
    font-weight: 700;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-tertiary);
  }

  .table-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2rem;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border-secondary);
    transition: all var(--transition-normal);
  }

  .table-row:hover {
    background: var(--color-bg-accent);
  }

  .table-row.highlight {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
    border: 2px solid var(--color-primary);
    border-radius: 8px;
    margin: 0.5rem 0;
  }

  .tier-range {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .range-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .range-description {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .tier-fee {
    font-size: 2rem;
    font-weight: 800;
    color: var(--color-primary);
    display: flex;
    align-items: center;
  }

  .table-footer {
    display: flex;
    justify-content: center;
    padding: 1.5rem;
    color: var(--color-primary);
    animation: bounce 2s infinite;
  }

  @keyframes bounce {
    0%,
    20%,
    50%,
    80%,
    100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-10px);
    }
    60% {
      transform: translateY(-5px);
    }
  }

  .pricing-footer {
    text-align: center;
    padding: 2rem;
  }

  .btn-large {
    padding: 1.25rem 2.5rem;
    font-size: 1.125rem;
    font-weight: 700;
  }

  .pricing-footer p {
    margin: 1rem 0 0 0;
    color: var(--color-text-secondary);
    font-size: 0.95rem;
  }

  /* Products Section */
  .products {
    margin-bottom: 4rem;
  }

  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 2rem;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: var(--color-bg-primary);
    border-radius: 12px;
    border: 2px dashed var(--color-border-secondary);
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    font-size: 1.5rem;
    color: var(--color-text-primary);
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    color: var(--color-text-secondary);
    margin: 0 0 1.5rem 0;
  }

  /* CTA Section */
  .cta-section {
    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
    border-radius: 16px;
    padding: 4rem 2rem;
    margin-bottom: 4rem;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .cta-section::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(255, 255, 255, 0.05) 10px,
      rgba(255, 255, 255, 0.05) 20px
    );
    animation: slide 20s linear infinite;
    pointer-events: none;
  }

  @keyframes slide {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(50px, 50px);
    }
  }

  .cta-content {
    position: relative;
    z-index: 1;
  }

  .cta-section h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 700;
    color: var(--color-text-inverse);
    margin: 0 0 1rem 0;
  }

  .cta-section p {
    font-size: 1.25rem;
    color: rgba(255, 255, 255, 0.9);
    max-width: 600px;
    margin: 0 auto 2rem;
  }

  .cta-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .cta-section .btn-primary {
    background: var(--color-text-inverse);
    color: var(--color-primary);
  }

  .cta-section .btn-primary:hover {
    background: var(--color-bg-primary);
  }

  .cta-section .btn-secondary {
    background: transparent;
    color: var(--color-text-inverse);
    border-color: var(--color-text-inverse);
  }

  .cta-section .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .hero {
      padding: 3rem 1rem;
    }

    .hero-stats {
      gap: 1rem;
    }

    .stat-divider {
      display: none;
    }

    .features-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .pricing-container {
      grid-template-columns: 1fr;
    }

    .pricing-model,
    .revenue-share {
      padding: 1.5rem;
    }

    .tier-fee {
      font-size: 1.5rem;
    }

    .table-row {
      grid-template-columns: 1fr auto;
      gap: 1rem;
      padding: 1rem;
    }

    .range-value {
      font-size: 1rem;
    }

    .product-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .cta-section {
      padding: 3rem 1.5rem;
    }

    .cta-actions {
      flex-direction: column;
    }

    .btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
