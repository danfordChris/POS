import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export type MembershipRole = 'owner' | 'staff';

export const ROLES_KEY = 'tenant-roles';

/** Restrict a route to specific membership roles. Must run after `TenantGuard`. */
export const Roles = (...roles: MembershipRole[]) =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MembershipRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const role = request.membership?.role;
    if (!role || !required.includes(role as MembershipRole)) {
      throw new ForbiddenException({
        code: 'role_forbidden',
        message: `Requires role: ${required.join(' or ')}`,
      });
    }
    return true;
  }
}
