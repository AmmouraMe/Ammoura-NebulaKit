<script lang="ts">
  import { beforeNavigate, afterNavigate, goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';

  import Avatar from '$lib/components/Avatar.svelte';
  import NotificationCenter from '$lib/components/notifications/NotificationCenter.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { authStore, authState } from '$lib/stores/auth';
  import { t } from '$lib/i18n';
  import { formatRole } from '$lib/utils/roleLabel';
  import { themeStore } from '$lib/stores/theme';
  import type { Notification } from '$lib/types/notifications';

  let isSidebarOpen = false;
  let isSettingsSubmenuOpen = false;
  let isAIChatSubmenuOpen = false;
  let isArchivedSubmenuOpen = false;
  let isSiteSubmenuOpen = false;
  let isContentSubmenuOpen = false;
  let currentPath = '';
  let notifications: Notification[] = [];
  let unreadCount = 0;

  $: currentPath = $page.url.pathname;

  // Close sidebar on navigation
  beforeNavigate(() => {
    isSidebarOpen = false;
  });

  // Ensure scroll is enabled after navigation
  afterNavigate(() => {
    // Reset scroll position to top
    window.scrollTo(0, 0);
    // Ensure body overflow is not hidden and builder class is removed
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.classList.remove('builder-active');
    }
  });
  $: isLoginPage = currentPath === '/auth/login';
  $: sessions = $page.data?.sessions || [];
  $: archivedSessions = $page.data?.archivedSessions || [];
  $: hasAIChat = $page.data?.hasAIChat || false;
  $: contentTypes = $page.data?.contentTypes || [];
  $: {
    // Auto-expand settings submenu if on a settings page
    if (
      currentPath.startsWith('/admin/settings') ||
      currentPath.startsWith('/admin/providers') ||
      currentPath.startsWith('/admin/themes') ||
      currentPath.startsWith('/admin/categories') ||
      currentPath.startsWith('/admin/equipment')
    ) {
      isSettingsSubmenuOpen = true;
    } else {
      isSettingsSubmenuOpen = false;
    }
    // Auto-expand AI chat submenu if on AI chat page
    if (currentPath.startsWith('/admin/ai-chat')) {
      isAIChatSubmenuOpen = true;
    } else {
      isAIChatSubmenuOpen = false;
    }
    // Auto-expand Builder submenu if on pages, layouts, components, or primitives page
    if (
      currentPath.startsWith('/admin/pages') ||
      currentPath.startsWith('/admin/builder') ||
      currentPath.startsWith('/admin/layouts') ||
      currentPath.startsWith('/admin/components') ||
      currentPath.startsWith('/admin/primitives')
    ) {
      isSiteSubmenuOpen = true;
    } else {
      isSiteSubmenuOpen = false;
    }
    // Auto-expand Content submenu if on a content page
    if (currentPath.startsWith('/admin/content')) {
      isContentSubmenuOpen = true;
    } else {
      isContentSubmenuOpen = false;
    }
  }

  async function fetchNotifications() {
    try {
      const response = await fetch('/api/admin/notifications');
      if (response.ok) {
        const data = (await response.json()) as {
          notifications: Notification[];
          unreadCount: number;
        };
        notifications = data.notifications;
        unreadCount = data.unreadCount;
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }

  onMount(() => {
    // Initialize theme from localStorage
    themeStore.initTheme();

    // Check authentication and role on mount, but allow login page
    if (!isLoginPage) {
      if (!$authStore.isAuthenticated) {
        // User not authenticated, redirect to login
        goto('/auth/login', { replaceState: true });
      } else if (!authStore.canAccessAdmin()) {
        // User is authenticated but doesn't have admin privileges
        // Redirect to main site
        goto('/', { replaceState: true });
      } else {
        // Fetch notifications for authenticated admin users
        fetchNotifications();

        // Refresh notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
      }
    }
  });

  onDestroy(() => {
    themeStore.cleanup();
  });

  async function handleLogout(): Promise<void> {
    // Clear server-side session cookies first and wait for completion
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });

    // Clear client-side auth state directly
    authState.set({
      user: null,
      isAuthenticated: false,
      isLoading: false
    });

    // Invalidate all data to refresh server state (currentUser will now be null)
    await invalidateAll();

    // Navigate to login
    goto('/auth/login');
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }

  function closeSidebar() {
    isSidebarOpen = false;
  }

  function toggleSettingsSubmenu() {
    isSettingsSubmenuOpen = !isSettingsSubmenuOpen;
  }

  function toggleAIChatSubmenu() {
    isAIChatSubmenuOpen = !isAIChatSubmenuOpen;
  }

  function toggleSiteSubmenu() {
    isSiteSubmenuOpen = !isSiteSubmenuOpen;
  }

  function toggleContentSubmenu() {
    isContentSubmenuOpen = !isContentSubmenuOpen;
  }

  function formatSessionDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  async function archiveSession(sessionId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    try {
      const response = await fetch(`/api/ai-chat/sessions?id=${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      });

      if (!response.ok) {
        throw new Error('Failed to archive session');
      }

      // Reload page data to refresh session lists
      window.location.reload();
    } catch (error) {
      console.error('Failed to archive session:', error);
      alert('Failed to archive session. Please try again.');
    }
  }

  async function unarchiveSession(sessionId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    try {
      const response = await fetch(`/api/ai-chat/sessions?id=${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });

      if (!response.ok) {
        throw new Error('Failed to unarchive session');
      }

      // Reload page data to refresh session lists
      window.location.reload();
    } catch (error) {
      console.error('Failed to unarchive session:', error);
      alert('Failed to unarchive session. Please try again.');
    }
  }

  function toggleArchivedSubmenu() {
    isArchivedSubmenuOpen = !isArchivedSubmenuOpen;
  }
</script>

{#if isLoginPage}
  <!-- Login page doesn't use the admin layout -->
  <slot />
{:else if $authStore.isAuthenticated}
  <div class="admin-layout">
    <!-- Mobile Header -->
    <header class="mobile-header">
      <button class="menu-toggle" on:click={toggleSidebar} aria-label="Toggle menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 12h18M3 6h18M3 18h18" stroke-width="2" stroke-linecap="round"></path>
        </svg>
      </button>
      <h1>{$page.data?.storeName || 'Hermes eCommerce'} Admin</h1>
      <div class="header-actions">
        <NotificationCenter {notifications} {unreadCount} />
        <a
          href="/"
          class="open-site-link-mobile"
          aria-label="Open main site"
          on:click={closeSidebar}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
        </a>
        <ThemeToggle />
      </div>
    </header>

    <!-- Sidebar -->
    <aside class="sidebar" class:open={isSidebarOpen}>
      <div class="sidebar-header">
        <h2>{$page.data?.storeName || 'Hermes eCommerce'} Admin</h2>
        <button class="close-sidebar" on:click={closeSidebar} aria-label="Close menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round"></path>
          </svg>
        </button>
      </div>

      <a href="/" class="open-site-link" aria-label="Open main site" on:click={closeSidebar}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
        </svg>
        Open site
      </a>

      <nav class="sidebar-nav">
        <a
          href="/admin/dashboard"
          class:active={currentPath === '/admin/dashboard'}
          on:click={closeSidebar}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
            <path d="M9 22V12h6v10" stroke-width="2" stroke-linecap="round"></path>
          </svg>
          Dashboard
        </a>

        <!-- AI Chat with submenu -->
        {#if hasAIChat}
          <div class="menu-item-with-submenu">
            <button
              class="menu-item-button"
              class:active={currentPath.startsWith('/admin/ai-chat')}
              on:click={toggleAIChatSubmenu}
            >
              <div class="menu-item-content">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                <span>AI</span>
              </div>
              <svg
                class="chevron"
                class:open={isAIChatSubmenuOpen}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M9 18l6-6-6-6"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>
              </svg>
            </button>

            {#if isAIChatSubmenuOpen}
              <div class="submenu">
                <a
                  href="/admin/ai-chat"
                  class:active={currentPath === '/admin/ai-chat'}
                  on:click={closeSidebar}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>
                  </svg>
                  New Chat
                </a>

                <div class="submenu-section">
                  <div class="submenu-section-header">
                    <div class="submenu-section-title">Chat History</div>
                  </div>
                  {#if sessions.length === 0}
                    <div class="submenu-empty">No chat history yet</div>
                  {:else}
                    {#each sessions.slice(0, 10) as session (session.id)}
                      <a
                        href="/admin/ai-chat?session={session.id}"
                        class:active={currentPath === '/admin/ai-chat' &&
                          $page.url.searchParams.get('session') === session.id}
                        on:click={closeSidebar}
                        class="session-submenu-item"
                      >
                        <div class="session-submenu-content">
                          <div class="session-submenu-title">{session.title}</div>
                          <div class="session-submenu-meta">
                            {formatSessionDate(session.updated_at)} • {session.messages.length} msgs
                          </div>
                        </div>
                        <button
                          type="button"
                          class="session-action-btn archive"
                          on:click={(e) => archiveSession(session.id, e)}
                          title="Archive"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <path
                              d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            ></path>
                          </svg>
                        </button>
                      </a>
                    {/each}
                  {/if}
                </div>

                {#if archivedSessions.length > 0}
                  <div class="submenu-section">
                    <button
                      class="submenu-section-header submenu-section-toggle"
                      on:click={toggleArchivedSubmenu}
                    >
                      <div class="submenu-section-title">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          ></path>
                        </svg>
                        Archived ({archivedSessions.length})
                      </div>
                      <svg
                        class="chevron"
                        class:open={isArchivedSubmenuOpen}
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M9 18l6-6-6-6"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        ></path>
                      </svg>
                    </button>

                    {#if isArchivedSubmenuOpen}
                      {#each archivedSessions.slice(0, 10) as session (session.id)}
                        <a
                          href="/admin/ai-chat?session={session.id}"
                          class:active={currentPath === '/admin/ai-chat' &&
                            $page.url.searchParams.get('session') === session.id}
                          on:click={closeSidebar}
                          class="session-submenu-item archived"
                        >
                          <div class="session-submenu-content">
                            <div class="session-submenu-title">{session.title}</div>
                            <div class="session-submenu-meta">
                              {formatSessionDate(session.updated_at)} • {session.messages.length} msgs
                            </div>
                          </div>
                          <button
                            type="button"
                            class="session-action-btn unarchive"
                            on:click={(e) => unarchiveSession(session.id, e)}
                            title="Unarchive"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                            >
                              <path
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              ></path>
                            </svg>
                          </button>
                        </a>
                      {/each}
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        <a
          href="/admin/products"
          class:active={currentPath.startsWith('/admin/products')}
          on:click={closeSidebar}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
          Products
        </a>

        <!-- Content with submenu (Content Types) -->
        <div class="menu-item-with-submenu">
          <button
            class="menu-item-button"
            class:active={currentPath.startsWith('/admin/content')}
            on:click={toggleContentSubmenu}
          >
            <div class="menu-item-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>
                <polyline
                  points="14 2 14 8 20 8"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></polyline>
                <line
                  x1="16"
                  y1="13"
                  x2="8"
                  y2="13"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
                <line
                  x1="16"
                  y1="17"
                  x2="8"
                  y2="17"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
              </svg>
              <span>Content</span>
            </div>
            <svg
              class="chevron"
              class:open={isContentSubmenuOpen}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M9 18l6-6-6-6"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
          </button>

          {#if isContentSubmenuOpen}
            <div class="submenu">
              <a
                href="/admin/content"
                class:active={currentPath === '/admin/content'}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Manage Types
              </a>

              {#each contentTypes as ct (ct.id)}
                <a
                  href="/admin/content/{ct.id}/entries"
                  class:active={currentPath.startsWith(`/admin/content/${ct.id}`)}
                  on:click={closeSidebar}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>
                    <path
                      d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
                      stroke-width="2"
                      stroke-linecap="round"
                    ></path>
                  </svg>
                  {ct.name}
                </a>
              {/each}
            </div>
          {/if}
        </div>

        <a
          href="/admin/orders"
          class:active={currentPath.startsWith('/admin/orders') &&
            !currentPath.startsWith('/admin/orders/fulfillment')}
          on:click={closeSidebar}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke-width="2"></rect>
            <path d="M9 14l2 2 4-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            ></path>
          </svg>
          Orders
        </a>

        <a
          href="/admin/orders/fulfillment"
          class:active={currentPath.startsWith('/admin/orders/fulfillment')}
          on:click={closeSidebar}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
            <circle cx="5.5" cy="18.5" r="2.5" stroke-width="2"></circle>
            <circle cx="18.5" cy="18.5" r="2.5" stroke-width="2"></circle>
          </svg>
          Fulfillment
        </a>

        <!-- Builder with submenu (Pages, Layouts, Components, Primitives) -->
        <div class="menu-item-with-submenu">
          <button
            class="menu-item-button"
            class:active={currentPath.startsWith('/admin/pages') ||
              currentPath.startsWith('/admin/builder') ||
              currentPath.startsWith('/admin/layouts') ||
              currentPath.startsWith('/admin/components') ||
              currentPath.startsWith('/admin/primitives')}
            on:click={toggleSiteSubmenu}
          >
            <div class="menu-item-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></rect>
                <line x1="3" y1="9" x2="21" y2="9" stroke-width="2" stroke-linecap="round"></line>
                <line x1="3" y1="15" x2="21" y2="15" stroke-width="2" stroke-linecap="round"></line>
                <line x1="12" y1="3" x2="12" y2="21" stroke-width="2" stroke-linecap="round"></line>
              </svg>
              <span>Builder</span>
            </div>
            <svg
              class="chevron"
              class:open={isSiteSubmenuOpen}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M9 18l6-6-6-6"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
          </button>

          {#if isSiteSubmenuOpen}
            <div class="submenu">
              <a
                href="/admin/pages"
                class:active={currentPath.startsWith('/admin/pages') ||
                  currentPath.startsWith('/admin/builder')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke-width="2" stroke-linecap="round"
                  ></path>
                </svg>
                Pages
              </a>

              <a
                href="/admin/layouts"
                class:active={currentPath.startsWith('/admin/layouts')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    ry="2"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></rect>
                  <line x1="3" y1="9" x2="21" y2="9" stroke-width="2" stroke-linecap="round"></line>
                  <line x1="9" y1="21" x2="9" y2="9" stroke-width="2" stroke-linecap="round"></line>
                </svg>
                Layouts
              </a>

              <a
                href="/admin/components"
                class:active={currentPath.startsWith('/admin/components')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <path
                    d="M2 17l10 5 10-5"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <path
                    d="M2 12l10 5 10-5"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Components
              </a>

              <a
                href="/admin/primitives"
                class:active={currentPath.startsWith('/admin/primitives')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect
                    x="3"
                    y="3"
                    width="7"
                    height="7"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></rect>
                  <rect
                    x="14"
                    y="3"
                    width="7"
                    height="7"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></rect>
                  <rect
                    x="14"
                    y="14"
                    width="7"
                    height="7"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></rect>
                  <rect
                    x="3"
                    y="14"
                    width="7"
                    height="7"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></rect>
                </svg>
                Primitives
              </a>
            </div>
          {/if}
        </div>

        <a
          href="/admin/users"
          class:active={currentPath.startsWith('/admin/users') &&
            !currentPath.startsWith('/admin/settings/admin-users')}
          on:click={closeSidebar}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
            <circle cx="9" cy="7" r="4" stroke-width="2"></circle>
            <path
              d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
          Users
        </a>

        <!-- Settings with submenu -->
        <div class="menu-item-with-submenu">
          <button
            class="menu-item-button"
            class:active={currentPath.startsWith('/admin/settings') ||
              currentPath.startsWith('/admin/providers') ||
              currentPath.startsWith('/admin/themes')}
            on:click={toggleSettingsSubmenu}
          >
            <div class="menu-item-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>
                <path
                  d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>
              </svg>
              <span>Settings</span>
            </div>
            <svg
              class="chevron"
              class:open={isSettingsSubmenuOpen}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M9 18l6-6-6-6"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
          </button>

          {#if isSettingsSubmenuOpen}
            <div class="submenu">
              <a
                href="/admin/providers"
                class:active={currentPath.startsWith('/admin/providers')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <circle cx="12" cy="12" r="3" stroke-width="2"></circle>
                </svg>
                Fulfillment
              </a>
              <a
                href="/admin/settings/printful"
                class:active={currentPath.startsWith('/admin/settings/printful')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline
                    points="6 9 6 2 18 2 18 9"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></polyline>
                  <path
                    d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <rect
                    x="6"
                    y="14"
                    width="12"
                    height="8"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></rect>
                </svg>
                Printful
              </a>
              <a
                href="/admin/equipment"
                class:active={currentPath.startsWith('/admin/equipment')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Equipment
              </a>
              <a
                href="/admin/settings/shipping"
                class:active={currentPath.startsWith('/admin/settings/shipping')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Shipping
              </a>
              <a
                href="/admin/categories"
                class:active={currentPath.startsWith('/admin/categories')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M4 7h16M4 7v13a2 2 0 002 2h12a2 2 0 002-2V7M4 7l2-3h12l2 3M10 11v6M14 11v6"
                    stroke-width="2"
                    stroke-linecap="round"
                  ></path>
                </svg>
                Categories
              </a>
              <a
                href="/admin/themes"
                class:active={currentPath.startsWith('/admin/themes')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Themes
              </a>
              <a
                href="/admin/settings/sso"
                class:active={currentPath.startsWith('/admin/settings/sso')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                SSO
              </a>
              <a
                href="/admin/settings/ai"
                class:active={currentPath.startsWith('/admin/settings/ai')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                AI
              </a>
              <a
                href="/admin/settings/admin-users"
                class:active={currentPath.startsWith('/admin/settings/admin-users')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <circle cx="9" cy="7" r="4" stroke-width="2"></circle>
                  <path
                    d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Admin Users
              </a>
              <a
                href="/admin/settings/visibility"
                class:active={currentPath.startsWith('/admin/settings/visibility')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <circle cx="12" cy="12" r="3" stroke-width="2"></circle>
                </svg>
                Visibility
              </a>
              <a
                href="/admin/settings/languages"
                class:active={currentPath.startsWith('/admin/settings/languages')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" stroke-width="2"></circle>
                  <path
                    d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
                    stroke-width="2"
                  ></path>
                </svg>
                Languages
              </a>
              <a
                href="/admin/settings/tax"
                class:active={currentPath.startsWith('/admin/settings/tax')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Tax
              </a>
              <a
                href="/admin/settings/payment"
                class:active={currentPath.startsWith('/admin/settings/payment')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect
                    x="1"
                    y="4"
                    width="22"
                    height="16"
                    rx="2"
                    ry="2"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></rect>
                  <path d="M1 10h22" stroke-width="2" stroke-linecap="round"></path>
                </svg>
                Payment
              </a>
              <a
                href="/admin/settings/email"
                class:active={currentPath.startsWith('/admin/settings/email')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <path d="M22 6l-10 7L2 6" stroke-width="2" stroke-linecap="round"></path>
                </svg>
                Email
              </a>
              <a
                href="/admin/settings/api"
                class:active={currentPath.startsWith('/admin/settings/api')}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M16 18l6-6-6-6M8 6l-6 6 6 6"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                API
              </a>
              <a
                href="/admin/settings"
                class:active={currentPath === '/admin/settings'}
                on:click={closeSidebar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <path
                    d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Site
              </a>
            </div>
          {/if}
        </div>

        <a
          href="/admin/translations"
          class:active={currentPath.startsWith('/admin/translations')}
          on:click={closeSidebar}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
          Translations
        </a>

        <a
          href="/admin/activity-logs"
          class:active={currentPath.startsWith('/admin/activity-logs')}
          on:click={closeSidebar}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke-width="2" stroke-linecap="round"
            ></path>
          </svg>
          Activity Logs
        </a>

        {#if $authStore.user?.role === 'platform_engineer'}
          <a
            href="/admin/database"
            class:active={currentPath.startsWith('/admin/database')}
            on:click={closeSidebar}
            class="platform-engineer-link"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <ellipse cx="12" cy="5" rx="9" ry="3" stroke-width="2"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke-width="2"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke-width="2"></path>
            </svg>
            Database Navigator
            <span class="engineer-badge">PE</span>
          </a>
          <a
            href="/admin/sites"
            class:active={currentPath.startsWith('/admin/sites')}
            on:click={closeSidebar}
            class="platform-engineer-link"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2"></circle>
              <path
                d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
                stroke-width="2"
              ></path>
            </svg>
            All Sites
            <span class="engineer-badge">PE</span>
          </a>
        {/if}
      </nav>

      <div class="sidebar-footer">
        <a href="/user/profile" class="user-info">
          <Avatar name={$authStore.user?.name} size="large" variant="primary" />
          <div class="user-details">
            <div class="user-name">{$authStore.user?.name || 'Admin'}</div>
            <div class="user-role">{formatRole($authStore.user?.role || 'admin', $t)}</div>
          </div>
        </a>
        <button class="logout-btn" on:click={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
          Logout
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <slot />
    </main>

    <!-- Overlay for mobile -->
    {#if isSidebarOpen}
      <div
        class="overlay"
        role="button"
        tabindex="0"
        on:click={closeSidebar}
        on:keydown={(e) => e.key === 'Enter' && closeSidebar()}
      ></div>
    {/if}
  </div>
{:else}
  <!-- Loading or redirecting -->
  <div class="loading">
    <p>Loading...</p>
  </div>
{/if}

<style>
  .admin-layout {
    display: flex;
    min-height: 100vh;
    background: var(--color-bg-secondary);
  }

  .mobile-header {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border-secondary);
    padding: 0 1rem;
    align-items: center;
    justify-content: space-between;
    z-index: 100;
    transition:
      background-color var(--transition-normal),
      border-color var(--transition-normal);
  }

  .mobile-header h1 {
    font-size: 1.25rem;
    color: var(--color-primary);
    margin: 0;
    transition: color var(--transition-normal);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .menu-toggle {
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    transition: color var(--transition-normal);
  }

  .open-site-link-mobile {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: color var(--transition-normal);
  }

  .open-site-link-mobile:hover {
    color: var(--color-text-primary);
  }

  .sidebar {
    width: 260px;
    background: var(--color-bg-primary);
    border-right: 1px solid var(--color-border-secondary);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 200;
    transition:
      transform var(--transition-normal),
      background-color var(--transition-normal),
      border-color var(--transition-normal);
  }

  .sidebar-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border-secondary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: border-color var(--transition-normal);
  }

  .sidebar-header h2 {
    font-size: 1.5rem;
    color: var(--color-primary);
    margin: 0;
    transition: color var(--transition-normal);
  }

  .close-sidebar {
    display: none;
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: color var(--transition-normal);
  }

  .close-sidebar:hover {
    color: var(--color-text-primary);
  }

  .open-site-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    margin: 0.5rem 1rem;
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 6px;
    transition:
      background-color var(--transition-normal),
      color var(--transition-normal);
  }

  .open-site-link:hover {
    background: var(--color-bg-accent);
    color: var(--color-text-primary);
  }

  .sidebar-nav {
    flex: 1;
    padding: 1rem 0;
    overflow-y: auto;
  }

  .sidebar-nav a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1.5rem;
    color: var(--color-text-secondary);
    text-decoration: none;
    transition:
      background-color var(--transition-normal),
      color var(--transition-normal);
    font-weight: 500;
  }

  .sidebar-nav a:hover {
    background: var(--color-bg-accent);
    color: var(--color-text-primary);
  }

  .sidebar-nav a.active {
    background: var(--color-bg-accent);
    color: var(--color-primary);
    border-right: 3px solid var(--color-primary);
  }

  /* Submenu styles */
  .menu-item-with-submenu {
    margin: 0;
  }

  .menu-item-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.875rem 1.5rem;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    text-decoration: none;
    transition:
      background-color var(--transition-normal),
      color var(--transition-normal);
    font-weight: 500;
    font-size: 1rem;
    text-align: left;
    cursor: pointer;
  }

  .menu-item-button:hover {
    background: var(--color-bg-accent);
    color: var(--color-text-primary);
  }

  .menu-item-button.active {
    background: var(--color-bg-accent);
    color: var(--color-primary);
  }

  .menu-item-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .chevron {
    transition: transform var(--transition-normal);
    flex-shrink: 0;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .submenu {
    background: var(--color-bg-secondary);
    border-left: 2px solid var(--color-border-secondary);
    margin-left: 1.5rem;
  }

  .submenu a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
    color: var(--color-text-secondary);
    text-decoration: none;
    transition:
      background-color var(--transition-normal),
      color var(--transition-normal);
    font-weight: 500;
    font-size: 0.9rem;
  }

  .submenu a:hover {
    background: var(--color-bg-accent);
    color: var(--color-text-primary);
  }

  .submenu a.active {
    background: var(--color-bg-accent);
    color: var(--color-primary);
    border-right: 3px solid var(--color-primary);
  }

  .submenu-section {
    padding-top: 0.5rem;
  }

  .submenu-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem 0.25rem 3rem;
    gap: 0.5rem;
  }

  .submenu-section-toggle {
    width: 100%;
    background: none;
    /* Inherit, or the global filled-button colour makes this unreadable. */
    color: inherit;
    border: none;
    cursor: pointer;
    transition: background-color var(--transition-normal);
  }

  .submenu-section-toggle:hover {
    background: var(--color-bg-accent);
  }

  .submenu-section-toggle .submenu-section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .submenu-section-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .submenu-empty {
    padding: 0.5rem 1rem 0.5rem 3rem;
    font-size: 0.85rem;
    color: var(--color-text-tertiary);
    font-style: italic;
  }

  .session-submenu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 1rem 0.5rem 3rem;
    text-decoration: none;
    border-left: 3px solid transparent;
    transition:
      background-color var(--transition-normal),
      border-color var(--transition-normal),
      color var(--transition-normal);
  }

  .session-submenu-item.archived {
    opacity: 0.7;
  }

  .session-submenu-item:hover {
    background: var(--color-bg-accent);
  }

  .session-submenu-item.active {
    background: var(--color-bg-accent);
    border-left-color: var(--color-primary);
  }

  .session-submenu-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  .session-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    opacity: 0;
  }

  .session-submenu-item:hover .session-action-btn {
    opacity: 1;
  }

  .session-action-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .session-action-btn.archive:hover {
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-tertiary));
    color: var(--color-primary);
  }

  .session-action-btn.unarchive:hover {
    background: color-mix(in srgb, var(--color-success) 10%, var(--color-bg-tertiary));
    color: var(--color-success);
  }

  .session-submenu-title {
    font-size: 0.85rem;
    color: var(--color-text-primary);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-submenu-meta {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .sidebar-footer {
    margin-top: auto;
    border-top: 1px solid var(--color-border-primary);
    padding-top: 0.75rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
    text-decoration: none;
    border-radius: 8px;
    transition: background-color var(--transition-normal);
  }

  .user-info:hover {
    background-color: var(--color-bg-secondary);
  }

  .user-details {
    flex: 1;
  }
  .user-name {
    font-weight: 600;
    color: var(--color-text-primary);
    font-size: 0.9rem;
    transition: color var(--transition-normal);
  }

  .user-role {
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
    transition: color var(--transition-normal);
  }

  .logout-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color var(--transition-normal),
      border-color var(--transition-normal),
      color var(--transition-normal);
  }

  .logout-btn:hover {
    background: var(--color-danger);
    border-color: var(--color-danger);
    color: var(--color-text-inverse);
  }

  .main-content {
    flex: 1;
    margin-left: 260px;
    padding: 2rem;
    transition: margin-left var(--transition-normal);
  }

  .overlay {
    display: none;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  @media (max-width: 768px) {
    .mobile-header {
      display: flex;
    }

    .sidebar {
      transform: translateX(-100%);
    }

    .sidebar.open {
      transform: translateX(0);
    }

    .close-sidebar {
      display: block;
    }

    .main-content {
      margin-left: 0;
      padding: 1rem;
      padding-top: 76px;
    }

    .overlay {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 150;
    }
  }

  /* Platform Engineer specific styles */
  .platform-engineer-link {
    position: relative;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-engineer-gradient-start) 10%, transparent) 0%,
      color-mix(in srgb, var(--color-engineer-gradient-end) 10%, transparent) 100%
    );
    border-left: 3px solid var(--color-engineer-gradient-start);
  }

  .platform-engineer-link:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-engineer-gradient-start) 20%, transparent) 0%,
      color-mix(in srgb, var(--color-engineer-gradient-end) 20%, transparent) 100%
    );
  }

  .engineer-badge {
    margin-left: auto;
    padding: 0.25rem 0.5rem;
    background: linear-gradient(
      135deg,
      var(--color-engineer-gradient-start) 0%,
      var(--color-engineer-gradient-end) 100%
    );
    color: var(--color-engineer-text);
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
</style>
