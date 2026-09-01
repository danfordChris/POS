import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { BusinessesService } from '../businesses/businesses.service.js';

/** Kong presents `X-Internal-Api-Key`; nothing else may call `/internal/*`. */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-internal-api-key'];
    const expected = this.config.getOrThrow<string>('INTERNAL_API_KEY');
    if (provided !== expected) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Invalid internal API key',
      });
    }
    return true;
  }
}

@ApiExcludeController()
@Controller('internal')
@UseGuards(InternalApiKeyGuard)
export class InternalController {
  constructor(private readonly businesses: BusinessesService) {}

  /** Membership lookup for the Kong `pos-internal-context` plugin. */
  @Get('membership')
  async membership(
    @Query('business_id') businessId: string,
    @Query('user_id') userId: string,
  ): Promise<{ found: boolean; role: string | null; status: string | null }> {
    const membership = await this.businesses.findMembership(businessId, userId);
    return membership
      ? { found: true, role: membership.role, status: membership.status }
      : { found: false, role: null, status: null };
  }
}
