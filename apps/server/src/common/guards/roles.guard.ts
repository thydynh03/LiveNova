import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../decorators/current-user.decorator';

/**
 * Checks the caller's role against `@Roles(...)`.
 *
 * **The role is read from the database, not from the JWT.** Putting it in the
 * token would save a query, but an access token lives 15 minutes: demoting an
 * admin would leave them with full access for the rest of that window. Admin
 * routes are low-traffic, so the query is the right trade — revocation has to
 * be immediate.
 *
 * A soft-deleted account is refused even if its role still says ADMIN.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles on the route means this guard has nothing to say. It does not
    // imply "public" — JwtAuthGuard still runs.
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.userId;

    // Reached without authentication. Refusing is the only safe reading: a
    // misordered guard chain must not become an open door.
    if (!userId) throw new ForbiddenException('Không có quyền truy cập');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true },
    });

    if (!user || user.deletedAt || !required.includes(user.role)) {
      // Same message for "not an admin", "deleted" and "no such user" so the
      // endpoint cannot be used to probe who holds which role.
      throw new ForbiddenException('Không có quyền truy cập');
    }

    return true;
  }
}
