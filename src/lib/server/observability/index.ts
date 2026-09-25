/**
 * Observability: structured logging, error capture and redaction.
 *
 * See docs/OBSERVABILITY.md for the shape of a log line, the environment
 * variables, and why this is hand-rolled rather than a vendor SDK.
 */

export { scrub, scrubString, REDACTED } from './scrub';
export type { ScrubOptions } from './scrub';

export { createLogger, resolveLogLevel, isLogLevel, LOG_LEVELS } from './logger';
export type { Logger, LogLevel, LogContext, LoggerOptions } from './logger';

export {
  reportError,
  toErrorEvent,
  fingerprintError,
  shouldAlert,
  resetAlertThrottle
} from './report';
export type { ErrorEvent, ReportOptions } from './report';

export { checkHealth } from './health';
export type { HealthReport, HealthCheck, HealthStatus } from './health';
