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
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { LoginThrottlerGuard } from './guards/login-throttler.guard.js';
import { UserAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './current-subject.decorator.js';

const LOGIN_RATE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @UseGuards(LoginThrottlerGuard)
  @Throttle(LOGIN_RATE)
  register(@Body() dto: RegisterDto) {
    return this.auth.registerUser(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoginThrottlerGuard)
  @Throttle(LOGIN_RATE)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.loginUser(dto, req.headers['user-agent']);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto, req.headers['user-agent']);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(UserAuthGuard)
  me(@CurrentUser() user: { id: string }) {
    return this.auth.meForUser(user.id);
  }
}
