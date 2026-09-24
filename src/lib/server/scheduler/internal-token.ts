/**
 * The header the Worker's scheduled() handler uses to prove a dispatch call
 * came from inside the isolate.
 *
 * The token itself is minted per invocation in `worker/entry.js`, put on a
 * copy of `env`, and never leaves the Worker. It is shared here so the entry
 * and the endpoint cannot disagree about the header name.
 */
export const INTERNAL_SCHEDULER_TOKEN_HEADER = 'x-scheduler-internal-token';

/** The env key the per-invocation token is passed on. */
export const INTERNAL_SCHEDULER_TOKEN_ENV = 'SCHEDULER_INTERNAL_TOKEN';
