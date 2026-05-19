/**
 * Sentry stub — file mantenuto per evitare orphan import.
 * Sentry NON e' utilizzato in questo progetto: gestione errori custom.
 *
 * Se in futuro vuoi attivarlo, ripristina da git e segui i passi nei commenti
 * originali.
 */
export async function initSentry(): Promise<void> {
  // no-op
}
export function wireSentryHooks(_server: unknown): void {
  // no-op
}
export function reportError(_error: unknown, _context?: Record<string, unknown>): void {
  // no-op
}
export function reportMessage(
  _message: string,
  _level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
): void {
  // no-op
}
