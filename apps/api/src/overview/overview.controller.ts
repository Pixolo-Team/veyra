import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  type ActivityPage,
  type ActivityQuery,
  activityQuerySchema,
  type Overview,
} from '@veyra/contracts';
import { type AuthedRequest, CurrentUser } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ActivityService } from './activity.service';
import { OverviewService } from './overview.service';

type Authed = NonNullable<AuthedRequest['user']>;

@Controller('rooms/:roomId')
export class OverviewController {
  constructor(
    private readonly overview: OverviewService,
    private readonly activity: ActivityService,
  ) {}

  @Get('overview')
  get(@CurrentUser() user: Authed, @Param('roomId') roomId: string): Promise<Overview> {
    return this.overview.get(user.id, roomId);
  }

  @Get('activity')
  list(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
    @Query(new ZodValidationPipe(activityQuerySchema)) query: ActivityQuery,
  ): Promise<ActivityPage> {
    return this.activity.list(user.id, roomId, query);
  }

  @Get('activity.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csv(
    @CurrentUser() user: Authed,
    @Param('roomId') roomId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    res.setHeader('Content-Disposition', `attachment; filename="activity-${roomId}.csv"`);
    return this.activity.csv(user.id, roomId);
  }
}
