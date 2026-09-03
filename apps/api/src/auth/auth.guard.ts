import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { CookieOptions, Response } from 'express';
import { RequestContextService } from '../common/request-context';
import type { Env } from '../config/env';
import { type AuthedRequest, IS_PUBLIC_KEY } from './auth.decorators';
import { SessionService } from './session.service';

/**
 * Global guard: every route needs a valid session cookie unless marked `@Public`.
 * When SessionService slides the expiry forward, re-stamps the cookie so the
 * browser copy tracks the server.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly cookieName: string;
  private readonly cookieBase: CookieOptions;

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly requestCtx: RequestContextService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieName = config.get('SESSION_COOKIE_NAME', { infer: true });
    this.cookieBase = {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/',
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = req.cookies?.[this.cookieName] as string | undefined;

    /*
     * `@Public` means a session is not *required*, not that one is ignored.
     *
     * A public route reached by a signed-in caller should still know who they
     * are — `/auth/me` is the whole reason: it has to answer "nobody" without
     * a 401, and "you" when there is a cookie. So the resolve still runs, and
     * only the throwing is conditional.
     */
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Not signed in');
    }

    const resolved = await this.sessions.resolve(token);
    if (!resolved) {
      if (isPublic) return true;
      throw new UnauthorizedException('Session expired');
    }

    req.user = resolved.user;
    req.sessionToken = token;
    this.requestCtx.set({ userId: resolved.user.id });

    if (resolved.refreshedTo) {
      const res = context.switchToHttp().getResponse<Response>();
      res.cookie(this.cookieName, token, { ...this.cookieBase, expires: resolved.refreshedTo });
    }
    return true;
  }
}
