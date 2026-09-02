import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly ctx: RequestContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    this.ctx.run(
      { ip: req.ip, userAgent: req.get('user-agent') ?? undefined },
      () => next(),
    );
  }
}
