import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginThrottlerGuard } from './guards/login-throttler.guard.js';
import { OperatorAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentOperator } from './current-subject.decorator.js';

@ApiTags('auth')
@Controller('auth/operator')
export class OperatorAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.loginOperator(dto, req.headers['user-agent']);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(OperatorAuthGuard)
  me(@CurrentOperator() operator: { id: string }) {
    return this.auth.meForOperator(operator.id);
  }
}
