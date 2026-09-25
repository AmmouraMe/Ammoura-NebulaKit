import type { HandleClientError } from '@sveltejs/kit';

/**
 * Client-side error capture.
 *
 * Browser exceptions never reach the Worker's log stream, so they are posted to
 * `/api/observability/client-error`, which applies the same redaction and the
 * same structured log shape as a server error. Failures here are swallowed:
 * an error report that throws would replace the page's own error.
 */
export const handleError: HandleClientError = ({ error, event, status, message }) => {
  // 404s are not defects and would drown the signal.
  if (status !== 404) {
    try {
      const body = JSON.stringify({
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        route: event?.route?.id ?? event?.url?.pathname,
        status
      });
      // keepalive so a report survives the navigation that often follows.
      void fetch('/api/observability/client-error', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => undefined);
    } catch {
      // Reporting is best effort.
    }
  }

  return { message };
};
