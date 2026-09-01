import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface HealthReport {
  status: 'ok' | 'error';
  service: 'api';
  db: 'up' | 'down';
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    const dbUp = await this.prisma.pingDatabase();
    return {
      status: dbUp ? 'ok' : 'error',
      service: 'api',
      db: dbUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }
}
