/**
 * Redaction for anything that leaves the Worker as a log line or an error
 * report.
 *
 * This platform stores customer addresses and encrypted provider credentials,
 * so scrubbing is a requirement rather than a nicety (issue #75). The rule here
 * is deliberately blunt: redact on the *key name* first, because a value that
 * looks harmless today can hold a token tomorrow, and a key called
 * `client_secret` never stops being a secret.
 *
 * Values are then scanned for the shapes that leak even under an innocent key —
 * an email address in a `message`, a bearer token in a `url`.
 */

export const REDACTED = '[redacted]';

/**
 * Key names whose value never leaves. Matched case-insensitively as a
 * substring, so `stripeSecretKey`, `STRIPE_SECRET_KEY` and `secret` all hit.
 */
const SENSITIVE_KEY_PARTS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'cookie',
  'session',
  'credential',
  'signature',
  'privatekey',
  'private_key',
  'encryption',
  'salt',
  'hash',
  // PII: this platform holds real shipping addresses and buyer identities.
  'email',
  'phone',
  'address',
  'street',
  'postal',
  'zip',
  'firstname',
  'first_name',
  'lastname',
  'last_name',
  'fullname',
  'full_name',
  'card',
  'cvv',
  'cvc',
  'iban',
  'ssn',
  'taxid',
  'tax_id',
  'dob',
  'birth'
];

/** Substrings that mean "this key is fine", checked before the list above. */
const ALLOWED_KEY_EXACT = new Set([
  // A count of addresses is not an address; an id is not an identity.
  'addresscount',
  'emailcount',
  'hashalgorithm',
  'tokencount',
  'sessioncount'
]);

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/**
 * 13–19 digits, optionally spaced or dashed. A match is only redacted when it
 * also passes Luhn — otherwise a 13-digit epoch-millis timestamp would be
 * mistaken for a card number and every log line would lose its timings.
 */
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}
/** `Bearer xyz`, `token=xyz`, `key=xyz` inside a free-form string or URL. */
const INLINE_SECRET_RE =
  /\b(bearer\s+|(?:api[_-]?key|access[_-]?token|token|secret|password|signature)\s*[=:]\s*)([^\s&"']+)/gi;
/** Long opaque runs that are almost certainly a key rather than prose. */
const LONG_OPAQUE_RE = /\b[A-Za-z0-9_-]{40,}\b/g;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (ALLOWED_KEY_EXACT.has(normalized)) {
    return false;
  }
  const collapsed = normalized.replace(/_/g, '');
  return SENSITIVE_KEY_PARTS.some((part) => collapsed.includes(part.replace(/_/g, '')));
}

/**
 * Redact secret-shaped substrings from a free-form string. Used on messages,
 * stack frames and URLs, where the sensitive part has no key of its own.
 */
export function scrubString(value: string): string {
  return value
    .replace(INLINE_SECRET_RE, (_match, prefix: string) => `${prefix}${REDACTED}`)
    .replace(EMAIL_RE, REDACTED)
    .replace(CARD_RE, (match) => {
      const digits = match.replace(/[^0-9]/g, '');
      return digits.length >= 13 && passesLuhn(digits) ? REDACTED : match;
    })
    .replace(LONG_OPAQUE_RE, REDACTED);
}

export interface ScrubOptions {
  /** Give up past this depth rather than walking a cyclic or enormous object. */
  maxDepth?: number;
  /** Truncate any single string to this many characters. */
  maxStringLength?: number;
  /** Keep at most this many entries of an array. */
  maxArrayLength?: number;
}

const DEFAULTS: Required<ScrubOptions> = {
  maxDepth: 6,
  maxStringLength: 2048,
  maxArrayLength: 50
};

/**
 * Deep-copy a value with sensitive keys removed, secret-shaped strings
 * rewritten, and hard limits on size. Cycles resolve to '[circular]' rather
 * than throwing — a log call must never be the thing that breaks a request.
 */
export function scrub(value: unknown, options: ScrubOptions = {}): unknown {
  const limits = { ...DEFAULTS, ...options };
  return walk(value, limits, 0, new WeakSet());
}

function walk(
  value: unknown,
  limits: Required<ScrubOptions>,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    const scrubbed = scrubString(value);
    return scrubbed.length > limits.maxStringLength
      ? `${scrubbed.slice(0, limits.maxStringLength)}…[truncated]`
      : scrubbed;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[${typeof value}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      stack: value.stack ? scrubString(value.stack) : undefined
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= limits.maxDepth) {
    return '[max depth]';
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return '[circular]';
    }
    seen.add(value as object);

    if (Array.isArray(value)) {
      const kept = value
        .slice(0, limits.maxArrayLength)
        .map((entry) => walk(entry, limits, depth + 1, seen));
      if (value.length > limits.maxArrayLength) {
        kept.push(`[+${value.length - limits.maxArrayLength} more]`);
      }
      return kept;
    }

    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : walk(entry, limits, depth + 1, seen);
    }
    return out;
  }

  return String(value);
}
