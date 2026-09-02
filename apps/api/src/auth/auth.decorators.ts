import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';

/** Marks a route as reachable without a session (login, reset, health). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export interface AuthedRequest extends Request {
  user?: User;
  sessionToken?: string;
}

/** Injects the authenticated `User` (guaranteed present on guarded routes). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.user!;
});
