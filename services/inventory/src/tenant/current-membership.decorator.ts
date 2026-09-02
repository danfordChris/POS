import {
  ExecutionContext,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';

export interface CurrentMembershipValue {
  businessId: string;
  role: string;
}

/** The membership resolved by `TenantGuard` for the current request. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentMembershipValue => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.membership) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'No tenant membership on request',
      });
    }
    return request.membership;
  },
);
