import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { STRICT_THROTTLE } from '../common/throttler';
import {
  type LoginRequest,
  loginRequestSchema,
  type PasswordResetConfirm,
  passwordResetConfirmSchema,
  type PasswordResetRequest,
  passwordResetRequestSchema,
  type SessionUser,
  type SetPasswordRequest,
  setPasswordRequestSchema,
} from '@veyra/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { Env } from '../config/env';
import { type AuthedRequest, CurrentUser, Public } from './auth.decorators';
import { AuthService } from './auth.service';
import type { SessionContext } from './session.service';

function ctxOf(req: AuthedRequest): SessionContext {
  return { ip: req.ip, userAgent: req.get('user-agent') ?? undefined };
}

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly cookieBase: CookieOptions;

  constructor(
    private readonly auth: AuthService,
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

  @Public()
  @Throttle(STRICT_THROTTLE)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const { user, token, expiresAt } = await this.auth.login(body, ctxOf(req));
    res.cookie(this.cookieName, token, { ...this.cookieBase, expires: expiresAt });
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: AuthedRequest,
    @CurrentUser() user: NonNullable<AuthedRequest['user']>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(req.sessionToken!, user, ctxOf(req));
    res.clearCookie(this.cookieName, this.cookieBase);
  }

  /**
   * Who is signed in, or nobody.
   *
   * Public, and answers with `null` rather than 401. "Nobody is signed in" is
   * the *answer* to this question, not a failure to answer it — and behind the
   * guard it made every first paint of the app log a red 401 in the console,
   * which trains everyone to ignore the console on a product whose whole job
   * is keeping records.
   */
  @Public()
  @Get('me')
  me(@Req() req: AuthedRequest): { user: SessionUser | null } {
    return { user: req.user ? AuthService.toSessionUser(req.user) : null };
  }

  @Post('set-password')
  @HttpCode(204)
  async setPassword(
    @Body(new ZodValidationPipe(setPasswordRequestSchema)) body: SetPasswordRequest,
    @Req() req: AuthedRequest,
    @CurrentUser() user: NonNullable<AuthedRequest['user']>,
  ): Promise<void> {
    await this.auth.setPassword(user, body, req.sessionToken!, ctxOf(req));
  }

  @Public()
  @Throttle(STRICT_THROTTLE)
  @Post('password-reset')
  @HttpCode(202)
  async requestReset(
    @Body(new ZodValidationPipe(passwordResetRequestSchema)) body: PasswordResetRequest,
  ): Promise<{ ok: true }> {
    await this.auth.requestPasswordReset(body.email);
    return { ok: true };
  }

  @Public()
  @Throttle(STRICT_THROTTLE)
  @Post('password-reset/confirm')
  @HttpCode(204)
  async confirmReset(
    @Body(new ZodValidationPipe(passwordResetConfirmSchema)) body: PasswordResetConfirm,
    @Req() req: AuthedRequest,
  ): Promise<void> {
    await this.auth.confirmPasswordReset(body, ctxOf(req));
  }
}
