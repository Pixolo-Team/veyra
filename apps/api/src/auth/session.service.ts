import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Session, User } from '@prisma/client';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { newToken, sha256Hex } from './crypto';

export interface SessionContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Server-side sessions (mvp-plan §3). No JWT — a session is a row, so revoking
 * one (or all of a user's) takes effect on the next request.
 */
@Injectable()
export class SessionService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('SESSION_TTL_HOURS', { infer: true }) * 3600_000;
  }

  /** Returns the raw token to set as the cookie value. */
  async create(userId: string, ctx: SessionContext): Promise<{ token: string; expiresAt: Date }> {
    const token = newToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: sha256Hex(token),
        expiresAt,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });
    return { token, expiresAt };
  }

  /** Resolves a cookie token to its user, or null if missing/expired/revoked.
   *  Slides the expiry forward once the session is past its half-life so an
   *  active user isn't logged out mid-session, while an idle one still times out. */
  async resolve(
    token: string,
  ): Promise<{ session: Session; user: User; refreshedTo: Date | null } | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256Hex(token) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

    let refreshedTo: Date | null = null;
    const remaining = session.expiresAt.getTime() - Date.now();
    if (remaining < this.ttlMs / 2) {
      refreshedTo = new Date(Date.now() + this.ttlMs);
      await this.prisma.session.update({ where: { id: session.id }, data: { expiresAt: refreshedTo } });
      session.expiresAt = refreshedTo;
    }
    return { session, user: session.user, refreshedTo };
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: sha256Hex(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Used after a password change (D11: "ends other sessions"). */
  async revokeAllForUser(userId: string, exceptToken?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptToken ? { tokenHash: { not: sha256Hex(exceptToken) } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }
}
