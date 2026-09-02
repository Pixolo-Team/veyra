import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type {
  LoginRequest,
  PasswordResetConfirm,
  SessionUser,
  SetPasswordRequest,
} from '@veyra/contracts';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, newToken, sha256Hex, verifyPassword } from './crypto';
import { type SessionContext, SessionService } from './session.service';

const RESET_TTL_MS = 15 * 60_000;
const LOCKOUT_WINDOW_MS = 15 * 60_000;
const LOCKOUT_THRESHOLD = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  static toSessionUser(user: User): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      mustResetPassword: user.status === 'invited',
    };
  }

  async login(
    input: LoginRequest,
    ctx: SessionContext,
  ): Promise<{ user: SessionUser; token: string; expiresAt: Date }> {
    await this.assertNotLockedOut(input.email);
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const ok = user?.passwordHash
      ? await verifyPassword(user.passwordHash, input.password)
      : false;

    if (!user || !ok) {
      await this.audit.record({
        action: 'auth.login_failed',
        metadata: { email: input.email },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status === 'suspended') {
      throw new UnauthorizedException('Account suspended');
    }

    const { token, expiresAt } = await this.sessions.create(user.id, ctx);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record({
      action: 'auth.login',
      actorUserId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { user: AuthService.toSessionUser(user), token, expiresAt };
  }

  async logout(token: string, user: User, ctx: SessionContext): Promise<void> {
    await this.sessions.revoke(token);
    await this.audit.record({
      action: 'auth.logout',
      actorUserId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  /** Forced first-login reset off a one-time password (D11). Ends other sessions. */
  async setPassword(
    user: User,
    input: SetPasswordRequest,
    currentToken: string,
    ctx: SessionContext,
  ): Promise<void> {
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (input.newPassword === input.currentPassword) {
      throw new BadRequestException('New password must differ from the current one');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword), status: 'active' },
    });
    await this.sessions.revokeAllForUser(user.id, currentToken);
    await this.audit.record({
      action: 'auth.password_changed',
      actorUserId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    await this.enqueueSecurityEmail(user.email);
  }

  /** Always resolves the same way — no account enumeration (FR-AUTH). */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const token = newToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    await this.email.enqueue(user.email, 'password_reset', { token, expiresInMinutes: 15 });
    await this.audit.record({ action: 'auth.password_reset_requested', actorUserId: user.id });
  }

  async confirmPasswordReset(input: PasswordResetConfirm, ctx: SessionContext): Promise<void> {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256Hex(input.token) },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash: await hashPassword(input.newPassword), status: 'active' },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);
    await this.sessions.revokeAllForUser(row.userId);
    await this.audit.record({
      action: 'auth.password_reset_completed',
      actorUserId: row.userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id: row.userId } });
    await this.enqueueSecurityEmail(target.email);
  }

  /** Per-account brake on top of the per-IP throttle: 10 failures in 15 min → 429. */
  private async assertNotLockedOut(email: string): Promise<void> {
    const recentFailures = await this.prisma.auditEvent.count({
      where: {
        action: 'auth.login_failed',
        createdAt: { gte: new Date(Date.now() - LOCKOUT_WINDOW_MS) },
        metadata: { path: ['email'], equals: email },
      },
    });
    if (recentFailures >= LOCKOUT_THRESHOLD) {
      throw new HttpException(
        'Too many failed sign-in attempts. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async enqueueSecurityEmail(toEmail: string): Promise<void> {
    await this.email.enqueue(toEmail, 'password_changed');
  }
}
