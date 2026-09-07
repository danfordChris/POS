import { Controller, Get, Header, HttpCode, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { InternalContextGuard } from '@pos/nest-common';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { DocumentService } from './document.service.js';

/** Member-scoped invoice PDF. `302` to the stored object once rendered,
 * `202` + `Retry-After` while the `InvoiceIssued` render is still in flight. */
@ApiTags('invoice-pdf')
@Controller('businesses/:businessId/invoices/:id/pdf')
@UseGuards(InternalContextGuard, TenantGuard)
export class InvoicePdfController {
  constructor(private readonly documents: DocumentService) {}

  @Get()
  async get(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.documents.urlByInvoice(businessId, id);
    if (!url) {
      res.setHeader('Retry-After', '2');
      res.status(202).json({ status: 'pending', message: 'PDF is being generated.' });
      return;
    }
    res.redirect(302, url);
  }
}

/** Public invoice PDF — no auth. Kong routes `/v1/i/*` without the
 * `pos-internal-context` plugin. Lookup by the unguessable token only. */
@ApiTags('invoice-pdf')
@Controller('i/:token/pdf')
export class InvoicePdfPublicController {
  constructor(private readonly documents: DocumentService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  async get(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const url = await this.documents.urlByToken(token);
    if (!url) {
      res.setHeader('Retry-After', '2');
      res.status(202).json({ status: 'pending', message: 'PDF is being generated.' });
      return;
    }
    res.redirect(302, url);
  }
}
