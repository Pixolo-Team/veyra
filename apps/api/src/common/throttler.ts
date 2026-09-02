import { ThrottlerModule } from '@nestjs/throttler';

/**
 * In-memory rate limiting (single instance — a shared store is a later change if
 * the API scales out). One global `default` bucket; sensitive auth routes
 * tighten it per-handler with `@Throttle(STRICT_THROTTLE)`.
 */
export const throttlerModule = ThrottlerModule.forRoot({
  throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
});

/** ~1 attempt per 7s — enough for a human, not for a script. */
export const STRICT_THROTTLE = { default: { limit: 8, ttl: 60_000 } };
