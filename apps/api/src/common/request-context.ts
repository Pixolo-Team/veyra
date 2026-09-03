import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface RequestContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
  /**
   * The room this request turned out to be about.
   *
   * Filled in by the access checks rather than read off the route, because
   * most room-scoped paths don't name the room: `/annotations/:id` reaches
   * into one, and only the lookup that refuses knows which. Without this a
   * refusal lands in the log with no room, and so appears in nobody's.
   */
  roomId?: string;
}

/**
 * Ambient per-request data (who is acting, from where). Populated by
 * RequestContextMiddleware + the AuthGuard, read by services that would
 * otherwise thread `actorUserId` through every call — chiefly AuditService.
 *
 * This is also where a future RLS layer hangs: wrap a request's writes in a
 * transaction that runs `set_config('veyra.user_id', ctx.userId, true)` so
 * Postgres policies can key off it. Not done yet — see apps/api/README.md.
 */
@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestContext>();

  run<T>(ctx: RequestContext, fn: () => T): T {
    return this.als.run(ctx, fn);
  }

  get(): RequestContext {
    return this.als.getStore() ?? {};
  }

  /** Mutates the active store (the AuthGuard fills in userId after the middleware). */
  set(patch: Partial<RequestContext>): void {
    Object.assign(this.als.getStore() ?? {}, patch);
  }

  get userId(): string | undefined {
    return this.als.getStore()?.userId;
  }
}
