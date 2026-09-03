import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequestContextService } from '../common/request-context';
import { AuditService } from './audit.service';

/**
 * Records the reaches that were turned away.
 *
 * A data room's log is read to answer two questions, and only one of them is
 * about what happened. The other — did anyone try to get at something they
 * were not granted — has no answer at all if refusals are handled and
 * forgotten, because a refusal leaves no trace anywhere else: no document is
 * touched, no thread is written, nothing changes.
 *
 * It catches rather than replaces: the response is passed through exactly as
 * the exception described it, so this can never alter what a caller sees.
 */
@Catch(ForbiddenException, NotFoundException)
export class DeniedAccessFilter implements ExceptionFilter {
  constructor(
    private readonly audit: AuditService,
    private readonly requestCtx: RequestContextService,
  ) {}

  async catch(exception: HttpException, host: ArgumentsHost): Promise<void> {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { user?: { id: string } }>();
    const response = http.getResponse<Response>();

    /*
     * Only a signed-in caller's refusal is worth a row. An anonymous 404 is
     * usually a crawler or a stale link, and logging those buries the one
     * that matters — a participant reaching past their own grant — under
     * noise nobody can filter.
     */
    if (request.user?.id) {
      // The access check that refused records which room it was guarding;
      // the route often doesn't name one.
      const roomId = this.requestCtx.get().roomId ?? roomIdFrom(request);
      await this.audit.record({
        action: 'access.denied',
        roomId,
        actorUserId: request.user.id,
        targetType: 'request',
        metadata: {
          method: request.method,
          // The route pattern, not the filled-in URL: a log of raw paths is a
          // log of ids, which is unreadable and quietly leaks what exists.
          path: routeOf(request),
          status: exception.getStatus(),
          reason: exception.message,
        },
      });
    }

    const status = exception.getStatus();
    response.status(status).json(exception.getResponse());
  }
}

/** The room a refused request was reaching into, when the path names one. */
function roomIdFrom(request: Request): string | null {
  const params = request.params as Record<string, string> | undefined;
  return params?.roomId ?? null;
}

function routeOf(request: Request): string {
  const route = (request.route as { path?: string } | undefined)?.path;
  return route ? `${request.baseUrl ?? ''}${route}` : request.path;
}
