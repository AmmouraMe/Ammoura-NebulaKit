<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import type { AIChatMessage, AISession } from '$lib/types/ai-chat';
  import MediaPicker from '$lib/components/MediaPicker.svelte';
  import Avatar from '$lib/components/Avatar.svelte';

  export let data: PageData;

  let messages: AIChatMessage[] = [];
  let inputText = '';
  let isStreaming = false;
  let sessionId: string | null = null;
  let messagesContainer: HTMLDivElement;
  let isMediaPickerOpen = false;

  // Helper function to format timestamps
  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  // Helper function to format model name
  function formatModelName(model?: string): string {
    if (!model) return '';
    const names: Record<string, string> = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
      'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
      'grok-4.5': 'Grok 4.5'
    };
    return names[model] || model;
  }
  let selectedMedia: Array<{
    id: string;
    url: string;
    filename: string;
    type: 'image' | 'video';
    mimeType: string;
    size: number;
  }> = [];
  let createdProduct: { id: string; name: string } | null = null;
  let isCreatingProduct = false;
  let pendingUpdate = false;
  let updateFrameId: number | null = null;
  let lastUpdateTime = 0;
  const UPDATE_THROTTLE_MS = 50; // Update UI at most every 50ms
  let textareaElement: HTMLTextAreaElement;

  // Session state
  let currentSessionTitle = 'New Conversation';
  let isUpdatingUrlProgrammatically = false;

  // Watch for URL parameter changes to load different sessions
  $: {
    const sessionParam = $page.url.searchParams.get('session');

    // Skip if we're programmatically updating the URL (e.g., during session creation)
    // OR if we're currently streaming (to avoid clearing messages mid-stream)
    if (!isUpdatingUrlProgrammatically && !isStreaming) {
      if (sessionParam && sessionParam !== sessionId) {
        // Session parameter changed to a different value - load it
        loadSessionFromId(sessionParam);
      } else if (!sessionParam && sessionId !== null) {
        // URL cleared, reset to new conversation (but not while streaming)
        messages = [];
        sessionId = null;
        currentSessionTitle = 'New Conversation';
        createdProduct = null;
      }
    }
  }

  // Scroll to bottom without blocking
  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });
  }

  // Session management function
  async function loadSessionFromId(id: string) {
    // If we already have this session loaded with messages, don't reload
    if (sessionId === id && messages.length > 0) {
      return;
    }

    // Find session in data
    const session = data.sessions.find((s: AISession) => s.id === id);
    if (session) {
      messages = session.messages || [];
      sessionId = session.id;
      currentSessionTitle = session.title;
      await tick();
      scrollToBottom();
      if (textareaElement) {
        textareaElement.focus();
      }
    } else {
      // Session not found in initial data (might be newly created)
      // Keep current messages and sessionId as-is
    }
  }

  function handleMediaSelect(
    event: CustomEvent<
      Array<{
        id: string;
        url: string;
        filename: string;
        type: 'image' | 'video';
        mimeType: string;
        size: number;
      }>
    >
  ) {
    selectedMedia = [...selectedMedia, ...event.detail];
  }

  function removeMedia(index: number) {
    selectedMedia = selectedMedia.filter((_, i) => i !== index);
  }

  function openMediaPicker() {
    isMediaPickerOpen = true;
  }

  async function sendMessage() {
    if ((!inputText.trim() && selectedMedia.length === 0) || isStreaming) {
      return;
    }

    const messageText = inputText.trim();

    // Use selected media items as attachments
    const attachments: AIChatMessage['attachments'] = selectedMedia.map((media) => ({
      id: media.id,
      type: media.type,
      url: media.url,
      filename: media.filename,
      mimeType: media.mimeType,
      size: media.size
    }));

    // Add user message to UI
    const userMessage: AIChatMessage = {
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
      attachments
    };
    messages = [...messages, userMessage];

    // Clear input and media, then restore focus
    inputText = '';
    selectedMedia = [];
    await tick();
    if (textareaElement) {
      textareaElement.focus();
    }

    // Stream AI response
    isStreaming = true;
    const assistantMessage: AIChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    messages = [...messages, assistantMessage];
    await tick();
    scrollToBottom();

    // Function to batch UI updates using time-based throttling
    const scheduleUpdate = () => {
      if (pendingUpdate) return;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime;

      if (timeSinceLastUpdate >= UPDATE_THROTTLE_MS) {
        // Enough time has passed, update immediately
        lastUpdateTime = now;
        messages = [...messages];
        scrollToBottom();
      } else {
        // Schedule update for later
        pendingUpdate = true;
        const delay = UPDATE_THROTTLE_MS - timeSinceLastUpdate;
        updateFrameId = setTimeout(() => {
          lastUpdateTime = Date.now();
          messages = [...messages];
          scrollToBottom();
          pendingUpdate = false;
          updateFrameId = null;
        }, delay) as unknown as number;
      }
    };

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          message: messageText,
          attachments
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        let errorMessage = 'Failed to send message';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          // Skip empty lines
          if (!line.trim()) continue;

          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              const data = JSON.parse(jsonStr);

              if (data.error) {
                console.error('AI error from stream:', data.error);
                assistantMessage.content = `❌ ${data.error}`;
                // Cancel any pending updates and update immediately
                if (updateFrameId !== null) {
                  clearTimeout(updateFrameId);
                  pendingUpdate = false;
                  updateFrameId = null;
                }
                messages = [...messages];
                scrollToBottom();
                break;
              }

              if (data.sessionId && !sessionId) {
                // First time receiving session ID - set it and update URL
                sessionId = data.sessionId;
                // Update URL with session ID
                const currentUrl = $page.url;
                if (sessionId && currentUrl.searchParams.get('session') !== sessionId) {
                  isUpdatingUrlProgrammatically = true;
                  const newUrl = new URL(currentUrl);
                  newUrl.searchParams.set('session', sessionId);
                  // Use SvelteKit's goto with replaceState to properly update $page store
                  goto(newUrl.toString(), { replaceState: true, noScroll: true, keepFocus: true });
                  // Keep flag set longer to ensure reactive statement doesn't fire during URL update
                  setTimeout(() => {
                    isUpdatingUrlProgrammatically = false;
                  }, 500);
                }
              }

              // Capture model and usage info from final chunk
              if (data.model) {
                assistantMessage.model = data.model;
              }
              if (data.usage) {
                assistantMessage.usage = {
                  inputTokens: data.usage.inputTokens,
                  outputTokens: data.usage.outputTokens,
                  totalTokens: data.usage.totalTokens,
                  estimatedCost: data.estimatedCost || 0
                };
              }

              // Force reactive update to display the metadata
              if (data.model || data.usage) {
                messages = [...messages];
              }

              // Update session title if this is a new session and first message
              if (
                sessionId &&
                messages.length === 2 &&
                currentSessionTitle === 'New Conversation'
              ) {
                // Generate title from first user message
                const firstUserMsg = messages.find((m) => m.role === 'user')?.content || '';
                const autoTitle =
                  firstUserMsg.slice(0, 50) + (firstUserMsg.length > 50 ? '...' : '');
                currentSessionTitle = autoTitle;
                // Update in database
                fetch(`/api/ai-chat/sessions?id=${sessionId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: autoTitle })
                }).catch((err) => console.error('Failed to update session title:', err));
              }

              if (data.done && data.productCommand) {
                // AI wants to create a product
                // Cancel any pending updates and update immediately
                if (updateFrameId !== null) {
                  clearTimeout(updateFrameId);
                  pendingUpdate = false;
                  updateFrameId = null;
                }
                messages = [...messages];
                scrollToBottom();
                await handleProductCreation(data.productCommand);
              }

              if (!data.done && data.content) {
                // Accumulate content without triggering immediate re-render
                assistantMessage.content += data.content;
                // Schedule a batched update
                scheduleUpdate();
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', line, parseError);
              // Continue processing other lines
            }
          }
        }
      }

      // Ensure final update happens
      if (updateFrameId !== null) {
        clearTimeout(updateFrameId);
        pendingUpdate = false;
        updateFrameId = null;
      }
      messages = [...messages];
      scrollToBottom();
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      assistantMessage.content = `❌ Sorry, something went wrong: ${errorMessage}. Please try again.`;
      // Cancel any pending updates
      if (updateFrameId !== null) {
        clearTimeout(updateFrameId);
        pendingUpdate = false;
        updateFrameId = null;
      }
      messages = [...messages];
      scrollToBottom();
    } finally {
      isStreaming = false;
      // Restore focus to textarea after streaming completes
      await tick();
      if (textareaElement) {
        textareaElement.focus();
      }
    }
  }

  async function handleProductCreation(productCommand: {
    action: string;
    product: Record<string, unknown>;
  }) {
    // Validate command structure
    if (!productCommand || !productCommand.action || !productCommand.product) {
      console.error('Invalid product command structure:', productCommand);
      return;
    }

    if (productCommand.action !== 'create_product') {
      return;
    }

    isCreatingProduct = true;

    try {
      // Collect all image attachments from user messages in this conversation
      const allAttachments: Array<{
        id: string;
        type: 'image' | 'video';
        url: string;
        filename: string;
        mimeType: string;
        size: number;
      }> = [];

      for (const msg of messages) {
        if (msg.role === 'user' && msg.attachments && msg.attachments.length > 0) {
          // Filter to only images (can add video support later)
          const imageAttachments = msg.attachments
            .filter((att) => att.type === 'image')
            .map((att) => ({
              id: att.id,
              type: att.type,
              url: att.url,
              filename: att.filename,
              mimeType: att.mimeType,
              size: att.size
            }));
          allAttachments.push(...imageAttachments);
        }
      }

      const response = await fetch('/api/ai-chat/create-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product: productCommand.product,
          attachments: allAttachments
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create product');
      }

      const result = (await response.json()) as {
        success: boolean;
        product: {
          id: string;
          name: string;
          description: string;
          price: number;
          category: string;
          type: string;
          stock: number;
          tags: string[];
          image: string;
        };
      };

      // Add success message with product link to chat
      const successMessage = {
        role: 'assistant' as const,
        content: `Product "${result.product.name}" has been created successfully!`,
        timestamp: Date.now(),
        productLink: {
          productId: result.product.id,
          productName: result.product.name
        }
      };
      messages = [...messages, successMessage];

      // Save success message to database if we have a sessionId
      if (sessionId) {
        try {
          await fetch('/api/ai-chat/sessions/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              message: successMessage
            })
          });
        } catch (error) {
          console.error('Failed to save product success message:', error);
        }
      }

      // Set product creation state - will persist until user dismisses
      createdProduct = {
        id: result.product.id,
        name: result.product.name
      };
    } catch (error) {
      console.error('Product creation error:', error);

      // Add error message to chat
      const errorMessage = {
        role: 'assistant' as const,
        content: `❌ Sorry, there was an error creating the product. Please try again or create it manually.`,
        timestamp: Date.now()
      };
      messages = [...messages, errorMessage];
    } finally {
      isCreatingProduct = false;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  onMount(async () => {
    // Check for session ID in URL params
    const sessionParam = $page.url.searchParams.get('session');
    if (sessionParam) {
      await loadSessionFromId(sessionParam);
      return;
    }

    // Check for initial message and media from dashboard
    const initialMessage = sessionStorage.getItem('aiChatInitialMessage');
    const initialMediaStr = sessionStorage.getItem('aiChatInitialMedia');

    if (initialMessage) {
      sessionStorage.removeItem('aiChatInitialMessage');
      inputText = initialMessage;
    }

    if (initialMediaStr) {
      try {
        sessionStorage.removeItem('aiChatInitialMedia');
        selectedMedia = JSON.parse(initialMediaStr);
      } catch (e) {
        console.error('Failed to parse initial media:', e);
      }
    }

    if (initialMessage || selectedMedia.length > 0) {
      // Wait a tick for the input to be bound
      await tick();
      // Auto-send the message
      sendMessage();
    } else {
      // Focus input on mount
      if (textareaElement) {
        textareaElement.focus();
      }
    }
  });

  onDestroy(() => {
    // Clean up any pending timeouts
    if (updateFrameId !== null) {
      clearTimeout(updateFrameId);
    }
  });
</script>

<svelte:head>
  <title>AI Chat - Ammoura Admin</title>
</svelte:head>

<div class="chat-container">
  {#if !data.hasApiKeys}
    <div class="no-keys-banner">
      <div class="banner-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
        </svg>
        <h2>AI Chat Not Configured</h2>
        <p>To use the AI chat assistant, you need to configure at least one AI provider API key.</p>
        <a href="/admin/settings/ai" class="btn btn-primary"> Configure AI Settings </a>
      </div>
    </div>
  {:else}
    <!-- Main Chat Area -->
    <div class="main-chat-area">
      <!-- Chat Header -->
      <header class="chat-header">
        <div class="header-content">
          <div class="header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
          </div>
          <div class="header-text">
            <h1>{currentSessionTitle}</h1>
            <p>Product Creation Assistant</p>
          </div>
        </div>
      </header>

      <!-- Messages Area -->
      <div class="messages-container" bind:this={messagesContainer}>
        {#if messages.length === 0}
          <div class="welcome-screen">
            <div class="welcome-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>
              </svg>
            </div>
            <h2>Welcome to Ammoura AI</h2>
            <p>I'm here to help you create amazing product listings effortlessly.</p>
            <div class="suggestions">
              <button
                class="suggestion-chip"
                on:click={() => {
                  inputText = 'I want to add a new product';
                  sendMessage();
                }}
              >
                Add a new product
              </button>
              <button
                class="suggestion-chip"
                on:click={() => {
                  inputText = 'Help me create a product listing';
                  sendMessage();
                }}
              >
                Get help with product listing
              </button>
            </div>
          </div>
        {/if}

        {#each messages as message, i (message.timestamp + '-' + i)}
          {#if message.productLink}
            <!-- Product Creation Alert Card -->
            <div class="product-alert-card">
              <div class="alert-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M22 11.08V12a10 10 0 11-5.93-9.14"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <path
                    d="M22 4L12 14.01l-3-3"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
              </div>
              <div class="alert-content">
                <strong class="alert-title">✅ Product Created Successfully!</strong>
                <p class="product-name">{message.productLink.productName}</p>
                <p class="alert-message">{message.content}</p>
                <a
                  href="/admin/products/{message.productLink.productId}/edit"
                  class="btn-view-product-card"
                >
                  View & Edit Product
                </a>
              </div>
            </div>
          {:else}
            <!-- Regular Message -->
            <div class="message {message.role}">
              <div class="message-avatar">
                {#if message.role === 'user'}
                  <Avatar name={data.currentUser?.name} size="medium" variant="primary" />
                {:else}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>
                  </svg>
                {/if}
              </div>
              <div class="message-content">
                <div class="message-header">
                  <span class="message-timestamp">{formatTimestamp(message.timestamp)}</span>
                  {#if message.role === 'assistant' && message.model}
                    <span class="message-meta">
                      <span class="model-badge">{formatModelName(message.model)}</span>
                      {#if message.usage}
                        <span class="usage-info">
                          {message.usage.totalTokens.toLocaleString()} tokens · ${message.usage.estimatedCost.toFixed(
                            4
                          )}
                        </span>
                      {/if}
                    </span>
                  {/if}
                </div>
                {#if message.attachments && message.attachments.length > 0}
                  <div class="attachments-grid">
                    {#each message.attachments as attachment (attachment.id)}
                      {#if attachment.type === 'image'}
                        <img
                          src={attachment.url}
                          alt={attachment.filename}
                          class="attachment-image"
                        />
                      {/if}
                    {/each}
                  </div>
                {/if}
                {#if message.content}
                  <div class="message-text">{message.content}</div>
                {/if}
              </div>
            </div>
          {/if}
        {/each}

        {#if isStreaming}
          <div class="streaming-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
          </div>
        {/if}
      </div>

      <!-- Product Creation Status -->
      {#if isCreatingProduct}
        <div class="product-status creating">
          <div class="status-content">
            <div class="spinner"></div>
            <span>Creating product...</span>
          </div>
        </div>
      {/if}

      <!-- Product Created Success Banner -->
      {#if createdProduct}
        <div class="product-status success">
          <div class="status-content">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M22 11.08V12a10 10 0 11-5.93-9.14"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
              <path
                d="M22 4L12 14.01l-3-3"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
            <div class="status-text">
              <strong>Product created successfully!</strong>
              <span>{createdProduct.name}</span>
            </div>
            <a href="/admin/products/{createdProduct.id}/edit" class="btn-view-product">
              View Product
            </a>
            <button
              type="button"
              class="btn-dismiss"
              on:click={() => (createdProduct = null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      {/if}

      <!-- Input Area -->
      <div class="input-container">
        {#if selectedMedia.length > 0}
          <div class="selected-files">
            {#each selectedMedia as media, i}
              <div class="file-chip">
                {#if media.type === 'image'}
                  <img src={media.url} alt={media.filename} class="file-preview" />
                {:else}
                  <div class="file-icon">🎥</div>
                {/if}
                <span class="file-name">{media.filename}</span>
                <button
                  type="button"
                  class="remove-file"
                  on:click={() => removeMedia(i)}
                  aria-label="Remove media"
                >
                  ✕
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <div class="input-bar">
          <button
            type="button"
            class="attach-btn"
            on:click={openMediaPicker}
            disabled={isStreaming}
            aria-label="Select media"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
              <circle
                cx="8.5"
                cy="8.5"
                r="1.5"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></circle>
              <path
                d="M21 15l-5-5L5 21"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
          </button>

          <textarea
            bind:this={textareaElement}
            bind:value={inputText}
            on:keydown={handleKeyDown}
            placeholder="Describe your product or ask for help..."
            rows="1"
            disabled={isStreaming}
          ></textarea>

          <button
            type="button"
            class="send-btn"
            on:click={sendMessage}
            disabled={(!inputText.trim() && selectedMedia.length === 0) || isStreaming}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
    <!-- End of main-chat-area -->
  {/if}
</div>

<!-- Media Picker Modal -->
<MediaPicker
  bind:isOpen={isMediaPickerOpen}
  allowMultiple={true}
  on:select={handleMediaSelect}
  on:close={() => (isMediaPickerOpen = false)}
/>

<style>
  /* Override admin layout padding to make chat full-screen */
  :global(.main-content:has(.chat-container)) {
    padding: 0 !important;
    overflow: hidden;
  }

  .chat-container {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100vh;
    height: 100dvh; /* Dynamic viewport height for mobile */
    background: var(--color-bg-primary);
    overflow: hidden;
  }

  /* Mobile: Account for mobile header height */
  @media (max-width: 768px) {
    .chat-container {
      height: calc(100vh - 76px); /* Subtract mobile header */
      height: calc(100dvh - 76px);
    }
  }

  /* Main Chat Area */
  .main-chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  @media (max-width: 768px) {
    .main-chat-area {
      width: 100%;
    }
  }

  /* No Keys Banner */
  .no-keys-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
  }

  .banner-content {
    text-align: center;
    max-width: 500px;
  }

  .banner-content svg {
    color: var(--color-primary);
    margin-bottom: 1.5rem;
  }

  .banner-content h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 1rem 0;
  }

  .banner-content p {
    color: var(--color-text-secondary);
    margin: 0 0 2rem 0;
  }

  /* Chat Header */
  .chat-header {
    flex-shrink: 0;
    padding: 1rem;
    border-bottom: 1px solid var(--color-border-secondary);
    background: var(--color-bg-primary);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--color-primary);
    color: white;
  }

  .header-text h1 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .header-text p {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  /* Messages Container */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1rem;
    width: 100%; /* Ensure container fills available width */
    /* scroll-behavior: smooth removed - was causing jank during streaming */
    -webkit-overflow-scrolling: touch;
    min-height: 0; /* Allow flex child to shrink below content size */
  }

  /* Welcome Screen */
  .welcome-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;
  }

  .welcome-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
    margin-bottom: 1.5rem;
  }

  .welcome-screen h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 0.5rem 0;
  }

  .welcome-screen p {
    color: var(--color-text-secondary);
    margin: 0 0 2rem 0;
    max-width: 400px;
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
  }

  .suggestion-chip {
    padding: 0.75rem 1.25rem;
    border-radius: 24px;
    border: 1px solid var(--color-border-secondary);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-normal);
  }

  .suggestion-chip:hover {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-secondary));
  }

  /* Messages */
  .message {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    width: 100%; /* Ensure message spans full width */
    /* Animation removed - was causing performance issues during streaming */
  }

  .message.assistant {
    flex-direction: row;
    justify-content: flex-start; /* Align assistant messages to the left */
  }

  .message.user {
    flex-direction: row-reverse;
    justify-content: flex-start; /* Align user messages to the right */
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message-avatar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
  }

  .message.assistant .message-avatar {
    background: var(--color-primary);
    color: white;
  }

  .message-content {
    flex: 0 1 auto; /* Size based on content, not container */
    max-width: calc(100% - 50px);
    min-width: 0; /* Allow flex child to shrink */
    overflow-wrap: break-word;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    flex-wrap: wrap;
  }

  .message.user .message-header {
    justify-content: flex-end;
  }

  .message-timestamp {
    font-weight: 500;
  }

  .message-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .model-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    background: var(--color-bg-tertiary);
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .usage-info {
    font-size: 0.7rem;
    color: var(--color-text-tertiary);
  }

  .message-text {
    padding: 0.875rem 1.125rem;
    border-radius: 12px;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .message.assistant .message-text {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border-bottom-left-radius: 4px;
  }

  .message.user .message-text {
    background: var(--color-primary);
    color: white;
    border-bottom-right-radius: 4px;
  }

  /* Attachments */
  .attachments-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .attachment-image {
    width: 100%;
    height: 200px;
    object-fit: cover;
    border-radius: 8px;
  }

  /* Product Alert Card */
  .product-alert-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem;
    margin: 2rem auto;
    max-width: 500px;
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(34, 197, 94, 0.25);
    color: white;
    text-align: center;
  }

  .alert-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    backdrop-filter: blur(10px);
  }

  .alert-icon svg {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }

  .alert-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .alert-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: block;
  }

  .product-name {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    backdrop-filter: blur(10px);
  }

  .alert-message {
    font-size: 0.95rem;
    margin: 0;
    opacity: 0.95;
    line-height: 1.5;
  }

  .btn-view-product-card {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.875rem 2rem;
    margin-top: 0.5rem;
    background: white;
    color: #16a34a;
    border-radius: 10px;
    font-weight: 700;
    font-size: 1rem;
    text-decoration: none;
    transition: all var(--transition-normal);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .btn-view-product-card:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 768px) {
    .product-alert-card {
      margin: 1.5rem 1rem;
      padding: 1.5rem;
    }

    .alert-icon {
      width: 64px;
      height: 64px;
    }

    .alert-icon svg {
      width: 40px;
      height: 40px;
    }

    .alert-title {
      font-size: 1.25rem;
    }

    .product-name {
      font-size: 1rem;
    }
  }

  /* Streaming Indicator */
  .streaming-indicator {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
  }

  .streaming-indicator .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-tertiary);
    animation: pulse 1.4s infinite;
  }

  .streaming-indicator .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .streaming-indicator .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse {
    0%,
    80%,
    100% {
      opacity: 0.3;
    }
    40% {
      opacity: 1;
    }
  }

  /* Input Area */
  .input-container {
    flex-shrink: 0;
    border-top: 1px solid var(--color-border-secondary);
    background: var(--color-bg-primary);
    padding: 1rem;
    padding-bottom: env(safe-area-inset-bottom, 1rem);
  }

  .selected-files {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .file-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 8px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
  }

  .file-preview {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
  }

  .file-icon {
    font-size: 1.5rem;
  }

  .file-name {
    font-size: 0.875rem;
    color: var(--color-text-primary);
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-file {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: 1.125rem;
  }

  .remove-file:hover {
    color: var(--color-danger);
  }

  .input-bar {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    padding: 0.75rem;
    border-radius: 12px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
  }

  .input-bar:focus-within {
    border-color: var(--color-primary);
  }

  .attach-btn,
  .send-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-normal);
  }

  .attach-btn svg,
  .send-btn svg {
    display: block;
    flex-shrink: 0;
  }

  .attach-btn svg path,
  .send-btn svg path {
    stroke: currentColor;
  }

  .attach-btn:hover:not(:disabled),
  .send-btn:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .send-btn:not(:disabled) {
    background: var(--color-primary);
    color: white;
  }

  .send-btn:not(:disabled) svg path {
    stroke: white;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .attach-btn:disabled,
  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  textarea {
    flex: 1;
    resize: none;
    border: none;
    background: transparent;
    color: var(--color-text-primary);
    font-size: 1rem;
    font-family: inherit;
    line-height: 1.5;
    outline: none;
    max-height: 150px;
    overflow-y: auto;
  }

  textarea::placeholder {
    color: var(--color-text-tertiary);
  }

  textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-normal);
    border: none;
    font-size: 1rem;
    text-decoration: none;
    display: inline-block;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  /* Product Status Banners */
  .product-status {
    position: fixed;
    bottom: calc(80px + env(safe-area-inset-bottom, 0rem));
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateX(-50%) translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }

  .product-status .status-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(10px);
    min-width: 300px;
    max-width: 90vw;
  }

  .product-status.creating .status-content {
    background: rgba(100, 116, 139, 0.95);
    color: white;
  }

  .product-status.success .status-content {
    background: rgba(34, 197, 94, 0.95);
    color: white;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .status-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .status-text strong {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .status-text span {
    font-size: 0.85rem;
    opacity: 0.9;
  }

  .btn-view-product {
    padding: 0.5rem 1rem;
    background: white;
    color: #22c55e;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.875rem;
    text-decoration: none;
    transition: all var(--transition-normal);
    white-space: nowrap;
  }

  .btn-view-product:hover {
    background: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
  }

  .btn-dismiss {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1.25rem;
    line-height: 1;
    opacity: 0.7;
    transition: opacity var(--transition-normal);
  }

  .btn-dismiss:hover {
    opacity: 1;
  }

  /* Mobile-First Optimizations */
  @media (max-width: 768px) {
    /* Adjust for mobile admin header */
    :global(body:has(.chat-container)) {
      overflow: hidden;
      position: fixed;
      width: 100%;
      height: 100%;
    }

    .chat-header {
      padding: 0.75rem 1rem;
    }

    .header-content {
      gap: 0.5rem;
    }

    .header-icon {
      width: 36px;
      height: 36px;
    }

    .header-icon svg {
      width: 18px;
      height: 18px;
    }

    .header-text h1 {
      font-size: 1rem;
    }

    .header-text p {
      font-size: 0.8125rem;
    }

    .messages-container {
      padding: 0.75rem;
    }

    .message {
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .message-avatar {
      width: 32px;
      height: 32px;
    }

    .message-avatar svg {
      width: 16px;
      height: 16px;
    }

    .message-content {
      max-width: calc(100% - 42px);
    }

    .message-header {
      font-size: 0.6875rem;
      gap: 0.5rem;
      margin-bottom: 0.375rem;
    }

    .model-badge {
      font-size: 0.65rem;
      padding: 0.125rem 0.375rem;
    }

    .usage-info {
      font-size: 0.65rem;
    }

    .message-text {
      padding: 0.75rem 1rem;
      font-size: 0.9375rem;
      line-height: 1.5;
    }

    .attachments-grid {
      grid-template-columns: 1fr;
      gap: 0.375rem;
    }

    .attachment-image {
      height: 180px;
    }

    .welcome-screen {
      padding: 1rem;
    }

    .welcome-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 1rem;
    }

    .welcome-icon svg {
      width: 32px;
      height: 32px;
    }

    .welcome-screen h2 {
      font-size: 1.25rem;
    }

    .welcome-screen p {
      font-size: 0.9375rem;
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }

    .suggestions {
      gap: 0.5rem;
      max-width: 100%;
    }

    .suggestion-chip {
      padding: 0.625rem 1rem;
      font-size: 0.8125rem;
      flex: 0 0 auto;
      max-width: 100%;
      text-align: center;
    }

    .input-container {
      padding: 0.75rem;
      padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
    }

    .input-bar {
      padding: 0.625rem;
      gap: 0.5rem;
    }

    .attach-btn,
    .send-btn {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }

    .attach-btn svg,
    .send-btn svg {
      width: 18px;
      height: 18px;
    }

    textarea {
      font-size: 0.9375rem;
      max-height: 120px;
      line-height: 1.5;
    }

    .file-chip {
      padding: 0.375rem 0.5rem;
      max-width: 100%;
    }

    .file-preview {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }

    .file-name {
      font-size: 0.8125rem;
      max-width: calc(100vw - 160px);
      flex: 1;
      min-width: 0;
    }

    .product-status {
      bottom: calc(72px + env(safe-area-inset-bottom, 0rem));
      left: 0.75rem;
      right: 0.75rem;
      transform: none;
    }

    .product-status .status-content {
      padding: 0.875rem 1rem;
      gap: 0.75rem;
      min-width: auto;
      max-width: 100%;
      flex-wrap: wrap;
    }

    .status-text {
      flex: 1;
      min-width: 0;
    }

    .status-text strong {
      font-size: 0.875rem;
    }

    .status-text span {
      font-size: 0.8125rem;
      word-break: break-word;
    }

    .btn-view-product {
      padding: 0.5rem 0.875rem;
      font-size: 0.8125rem;
    }

    .no-keys-banner {
      padding: 1rem;
    }

    .banner-content {
      max-width: 100%;
      padding: 0 0.5rem;
    }

    .banner-content h2 {
      font-size: 1.25rem;
    }

    .banner-content p {
      font-size: 0.9375rem;
      line-height: 1.5;
    }

    .banner-content svg {
      width: 48px;
      height: 48px;
    }

    .banner-content .btn {
      width: 100%;
      text-align: center;
    }
  }

  /* Small Mobile (Portrait phones) */
  @media (max-width: 375px) {
    .header-text h1 {
      font-size: 0.9375rem;
    }

    .header-text p {
      font-size: 0.75rem;
    }

    .suggestion-chip {
      font-size: 0.75rem;
      padding: 0.5rem 0.875rem;
    }

    .file-name {
      max-width: calc(100vw - 140px);
    }

    .message-text {
      font-size: 0.875rem;
    }
  }

  /* Tablet Optimizations */
  @media (min-width: 769px) and (max-width: 1024px) {
    .message-content {
      max-width: 70%;
    }

    .product-status {
      bottom: calc(90px + env(safe-area-inset-bottom, 0rem));
    }

    .attachments-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Desktop Optimizations */
  @media (min-width: 1025px) {
    .message-content {
      max-width: 80%;
    }

    .attachments-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .suggestions {
      max-width: 1000px;
    }
  }

  /* Large Desktop */
  @media (min-width: 1440px) {
    .messages-container {
      max-width: 2000px;
      margin: 0 auto;
    }

    .welcome-screen {
      max-width: 2000px;
      margin: 0 auto;
    }

    .message-content {
      max-width: 85%;
    }
  }

  /* Landscape mobile phones */
  @media (max-width: 768px) and (orientation: landscape) {
    .chat-header {
      padding: 0.5rem 1rem;
    }

    .header-icon {
      width: 32px;
      height: 32px;
    }

    .header-text h1 {
      font-size: 0.9375rem;
    }

    .header-text p {
      display: none; /* Hide subtitle in landscape to save space */
    }

    .welcome-screen {
      padding: 0.75rem 1rem;
    }

    .welcome-icon {
      width: 48px;
      height: 48px;
      margin-bottom: 0.75rem;
    }

    .welcome-screen h2 {
      font-size: 1.125rem;
      margin-bottom: 0.25rem;
    }

    .welcome-screen p {
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .input-container {
      padding: 0.5rem 0.75rem;
    }

    textarea {
      max-height: 80px;
    }
  }
</style>
