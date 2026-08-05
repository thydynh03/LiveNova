import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface AuthUser {
  userId: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/**
 * Pulls the authenticated user id off the request.
 *
 * Controllers previously declared their own `AuthenticatedRequest` interface and
 * reached into `req.user.userId` by hand, which made it easy to forget to pass
 * the id down to the service layer (see C-07). One decorator, used everywhere.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user.userId;
  },
);
