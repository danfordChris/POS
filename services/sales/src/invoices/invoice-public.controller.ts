import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service.js';

/**
 * Public, unauthenticated invoice view. No guards — Kong routes `/v1/i/*`
 * WITHOUT the `pos-internal-context` plugin. Lookup is by the unguessable
 * `public_token` only; the response is a fixed snapshot whitelist.
 */
@ApiTags('invoice')
@Controller('i')
export class InvoicePublicController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get(':token')
  async get(@Param('token') token: string) {
    const invoice = await this.invoices.publicInvoice(token);
    if (!invoice) {
      throw new NotFoundException({
        code: 'not_found',
        message: 'Invoice not found.',
      });
    }
    return invoice;
  }
}
