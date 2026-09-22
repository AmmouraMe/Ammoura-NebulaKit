<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { X, Send, Sparkles, ImageIcon } from 'lucide-svelte';
  import type { AIChatMessage } from '$lib/types/ai-chat';
  import Avatar from '$lib/components/Avatar.svelte';
  import MediaPicker from '$lib/components/MediaPicker.svelte';

  // Props - entity data for context
  export let entityData: Record<string, unknown> | undefined = undefined;
  export let userName: string = 'User';
  export let compact = false; // For inline/sidebar vs full-page mode

  const dispatch = createEventDispatcher<{
    close: void;
    applyChanges: Record<string, unknown>;
  }>();

  // State
  let messages: AIChatMessage[] = [];
  let inputText = '';
  let isStreaming = false;
  let messagesContainer: HTMLDivElement;
  let isMediaPickerOpen = false;
  let selectedMedia: Array<{
    id: string;
    url: string;
    filename: string;
    type: 'image' | 'video';
    mimeType: string;
    size: number;
  }> = [];

  // Context detection - happens automatically based on URL
  let contextInfo: {
    type: string;
    capabilities: string[];
    suggestions: string[];
  } = {
    type: 'general_help',
    capabilities: [],
    suggestions: []
  };

  // Detect context on mount
  onMount(async () => {
    await detectContext();
  });

  // Watch for URL changes
  $: if ($page.url.pathname) {
    detectContext();
  }

  async function detectContext() {
    try {
      const response = await fetch('/api/ai-chat/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlPath: $page.url.pathname,
          entityData,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (response.ok) {
        const data = (await response.json()) as {
          context: { type: string };
          capabilities: string[];
          suggestions: string[];
        };
        contextInfo = {
          type: data.context.type,
          capabilities: data.capabilities,
          suggestions: data.suggestions
        };
      }
    } catch (error) {
      console.error('Failed to detect context:', error);
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });
  }

  function removeMedia(index: number) {
    selectedMedia = selectedMedia.filter((_, i) => i !== index);
  }

  async function sendMessage() {
    if ((!inputText.trim() && selectedMedia.length === 0) || isStreaming) return;

    const userMessage: AIChatMessage = {
      role: 'user',
      content: inputText.trim() || 'What do you see in this image?',
      timestamp: Date.now(),
      attachments: selectedMedia.map((media) => ({
        id: media.id,
        type: media.type,
        url: media.url,
        filename: media.filename,
        mimeType: media.mimeType,
        size: media.size
      }))
    };

    messages = [...messages, userMessage];
    inputText = '';
    selectedMedia = [];
    isStreaming = true;

    scrollToBottom();

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          attachments: userMessage.attachments,
          urlPath: $page.url.pathname,
          entityData,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        // Parse error message from response body
        let errorMessage = 'Failed to get AI response';
        try {
          const errorData = (await response.json()) as { message?: string };
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // If we can't parse the error, use the generic message
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response reader');
      }

      let aiMessage: AIChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      messages = [...messages, aiMessage];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.content) {
                aiMessage.content += parsed.content;
                messages = [...messages.slice(0, -1), { ...aiMessage }];
                scrollToBottom();
              }

              if (parsed.done) {
                // Check for commands in the final response
                if (parsed.productCommand) {
                  dispatch('applyChanges', {
                    type: 'product_command',
                    data: parsed.productCommand
                  });
                }

                if (parsed.widgetChanges) {
                  dispatch('applyChanges', {
                    type: 'widget_changes',
                    data: parsed.widgetChanges.changes
                  });
                }
              }
            } catch (e) {
              console.error('Failed to parse chunk:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.';
      messages = [
        ...messages,
        {
          role: 'assistant',
          content: errorMessage,
          timestamp: Date.now()
        }
      ];
    } finally {
      isStreaming = false;
      scrollToBottom();
      // Re-detect context after conversation
      await detectContext();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
</script>

<aside class="ai-assistant" class:compact>
  <div class="assistant-header">
    <div class="header-title">
      <Sparkles size={18} />
      <div>
        <h3>Ammoura AI</h3>
        <p class="context-type">{contextInfo.type.replace(/_/g, ' ')}</p>
      </div>
    </div>
    <button class="btn-close" on:click={() => dispatch('close')} aria-label="Close AI assistant">
      <X size={18} />
    </button>
  </div>

  <div class="messages-container" bind:this={messagesContainer}>
    {#if messages.length === 0}
      <div class="welcome-screen">
        <div class="welcome-icon">
          <Sparkles size={48} />
        </div>
        <h4>Welcome to Ammoura AI</h4>
        <p>I can help you with:</p>
        <ul class="capabilities-list">
          {#each contextInfo.capabilities as capability}
            <li>{capability}</li>
          {/each}
        </ul>

        {#if contextInfo.suggestions.length > 0}
          <div class="suggestions">
            <p class="suggestions-label">Try asking:</p>
            {#each contextInfo.suggestions as suggestion}
              <button
                type="button"
                class="suggestion-chip"
                on:click={() => {
                  inputText = suggestion;
                  sendMessage();
                }}
              >
                {suggestion}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      {#each messages as message, i (message.timestamp + '-' + i)}
        <div class="message {message.role}">
          <div class="message-avatar">
            {#if message.role === 'user'}
              <Avatar name={userName} size="small" variant="primary" />
            {:else}
              <div class="ai-avatar">
                <Sparkles size={16} />
              </div>
            {/if}
          </div>
          <div class="message-content">
            {#if message.attachments && message.attachments.length > 0}
              <div class="message-attachments">
                {#each message.attachments as attachment}
                  {#if attachment.type === 'image'}
                    <img src={attachment.url} alt={attachment.filename} class="attachment-image" />
                  {/if}
                {/each}
              </div>
            {/if}
            {#if message.content}
              <div class="message-text">{message.content}</div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}

    {#if isStreaming}
      <div class="streaming-indicator">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    {/if}
  </div>

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
        class="btn-attach"
        on:click={() => (isMediaPickerOpen = true)}
        aria-label="Attach media"
      >
        <ImageIcon size={20} />
      </button>
      <textarea
        bind:value={inputText}
        on:keydown={handleKeyDown}
        placeholder="Ask me anything..."
        rows="1"
        disabled={isStreaming}
      ></textarea>
      <button
        type="button"
        class="btn-send"
        on:click={sendMessage}
        disabled={(!inputText.trim() && selectedMedia.length === 0) || isStreaming}
        aria-label="Send message"
      >
        <Send size={20} />
      </button>
    </div>
  </div>

  <MediaPicker
    isOpen={isMediaPickerOpen}
    on:close={() => (isMediaPickerOpen = false)}
    on:select={(event) => {
      const media = event.detail[0];
      if (media) {
        selectedMedia = [
          ...selectedMedia,
          {
            id: media.id,
            url: media.url,
            filename: media.filename,
            type: media.type === 'image' ? 'image' : 'video',
            mimeType: media.mimeType,
            size: media.size
          }
        ];
      }
      isMediaPickerOpen = false;
    }}
  />
</aside>

<style>
  .ai-assistant {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--color-bg-primary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .assistant-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--color-border-secondary);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-title h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .context-type {
    margin: 0;
    font-size: 0.75rem;
    opacity: 0.9;
    text-transform: capitalize;
  }

  .btn-close {
    padding: 0.25rem;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .btn-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .welcome-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem 1rem;
  }

  .welcome-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    margin-bottom: 1rem;
  }

  .welcome-screen h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: var(--color-text-primary);
  }

  .welcome-screen p {
    margin: 0.5rem 0;
    color: var(--color-text-secondary);
  }

  .capabilities-list {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
    text-align: left;
    width: 100%;
  }

  .capabilities-list li {
    padding: 0.5rem 0;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .capabilities-list li:before {
    content: '✓ ';
    color: var(--color-success);
    font-weight: bold;
    margin-right: 0.5rem;
  }

  .suggestions {
    width: 100%;
    margin-top: 1.5rem;
  }

  .suggestions-label {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin-bottom: 0.75rem;
  }

  .suggestion-chip {
    display: inline-block;
    padding: 0.5rem 0.875rem;
    margin: 0.25rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 20px;
    font-size: 0.8125rem;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .suggestion-chip:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .message {
    display: flex;
    gap: 0.75rem;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
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
  }

  .ai-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .message-content {
    flex: 1;
    min-width: 0;
  }

  .message-attachments {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .attachment-image {
    width: 100%;
    height: 100px;
    object-fit: cover;
    border-radius: 8px;
  }

  .message-text {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .message.user .message-text {
    background: var(--color-primary);
    color: white;
  }

  .message.assistant .message-text {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-secondary);
  }

  .streaming-indicator {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    justify-content: center;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-primary);
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .dot:nth-child(1) {
    animation-delay: -0.32s;
  }

  .dot:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }

  .input-container {
    border-top: 1px solid var(--color-border-secondary);
    background: var(--color-bg-primary);
  }

  .selected-files {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.75rem 1rem 0 1rem;
  }

  .file-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    font-size: 0.75rem;
  }

  .file-preview {
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 4px;
  }

  .file-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    border-radius: 4px;
  }

  .file-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-file {
    padding: 0.25rem;
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }

  .remove-file:hover {
    color: var(--color-danger);
  }

  .input-bar {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    align-items: flex-end;
  }

  .btn-attach {
    padding: 0.75rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-attach:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-family: inherit;
    resize: none;
    max-height: 120px;
    min-height: 40px;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-send {
    padding: 0.75rem;
    background: var(--color-primary);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-send:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .messages-container {
      padding: 0.75rem;
    }

    .input-bar {
      padding: 0.75rem;
    }

    textarea {
      font-size: 16px; /* Prevent zoom on iOS */
    }
  }
</style>
