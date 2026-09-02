import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { STRICT_THROTTLE } from '../common/throttler';
import {
  type AcceptInvitationRequest,
  acceptInvitationRequestSchema,
  type CreateInvitationRequest,
  createInvitationRequestSchema,
  type InvitationDto,
  type InvitationPreview,
  type SessionUser,
} from '@veyra/contracts';
import { type AuthedRequest, CurrentUser, Public } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { Env } from '../config/env';
import { InvitationsService } from './invitations.service';

type Authed = NonNullable<AuthedRequest['user']>;

@Controller()
export class InvitationsController {
  private readonly cookieName: string;
  private readonly cookieBase: CookieOptions;

  constructor(
    private readonly invitations: InvitationsService,
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

  @Get('rooms/:roomId/invitations')
  list(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
  ): Promise<InvitationDto[]> {
    return this.invitations.list(user.id, roomId);
  }

  @Post('rooms/:roomId/invitations')
  create(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(createInvitationRequestSchema)) body: CreateInvitationRequest,
  ): Promise<InvitationDto> {
    return this.invitations.create(user, roomId, body);
  }

  @Public()
  @Get('invitations/:token')
  preview(@Param('token') token: string): Promise<InvitationPreview> {
    return this.invitations.preview(token);
  }

  @Public()
  @Throttle(STRICT_THROTTLE)
  @Post('invitations/accept')
  @HttpCode(200)
  async accept(
    @Body(new ZodValidationPipe(acceptInvitationRequestSchema)) body: AcceptInvitationRequest,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const { user, token, expiresAt } = await this.invitations.accept(body, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    res.cookie(this.cookieName, token, { ...this.cookieBase, expires: expiresAt });
    return { user };
  }
}
