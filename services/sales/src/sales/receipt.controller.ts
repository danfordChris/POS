import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SalesService } from './sales.service.js';

/**
 * Public, unauthenticated receipt view. No guards — Kong routes `/v1/r/*`
 * WITHOUT the `pos-internal-context` plugin. The lookup is by the unguessable
 * `public_token` only; the response carries snapshots and no internal IDs.
 */
@ApiTags('receipt')
@Controller('r')
export class ReceiptController {
  constructor(private readonly sales: SalesService) {}

  @Get(':token')
  async get(@Param('token') token: string) {
    const receipt = await this.sales.publicReceipt(token);
    if (!receipt)
      throw new NotFoundException({
        code: 'not_found',
        message: 'Receipt not found.',
      });
    return receipt;
  }
}
