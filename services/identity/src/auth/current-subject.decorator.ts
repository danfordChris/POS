import {
  ExecutionContext,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'No authenticated user',
      });
    }
    return request.user;
  },
);

export const CurrentOperator = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.operator) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'No authenticated operator',
      });
    }
    return request.operator;
  },
);
