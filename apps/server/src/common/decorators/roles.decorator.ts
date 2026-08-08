import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'requiredRoles';

/**
 * Restricts a route to the listed roles.
 *
 * `Role` has been in the schema since the beginning but nothing ever read it —
 * the enum was decoration, and every authenticated user could reach every
 * endpoint the guard allowed. This is the piece that makes it mean something.
 *
 * Must be combined with `JwtAuthGuard`: on its own `RolesGuard` has no user to
 * check, and it refuses rather than allowing in that case.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
