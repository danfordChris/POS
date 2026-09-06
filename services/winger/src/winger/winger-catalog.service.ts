import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListWingerProductsQuery } from './dto/list-products.dto.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export interface WingerBusinessView {
  business_id: string;
  business_name: string;
}

/** Fixed whitelist — a schema test asserts these are the ONLY keys returned. */
export interface WingerProductView {
  name: string;
  image_url: string | null;
  price: number;
  currency: string;
  in_stock: boolean;
}

export interface WingerProductPage {
  data: WingerProductView[];
  next_cursor: string | null;
}

@Injectable()
export class WingerCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Businesses the caller is an ACTIVE winger for. Cross-tenant read — relies
   * on the relaxed `winger_account` read policy (unscoped context). */
  async listBusinesses(userId: string): Promise<WingerBusinessView[]> {
    const accounts = await this.prisma.wingerAccount.findMany({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
    if (accounts.length === 0) return [];

    const businesses = await this.prisma.wingerBusiness.findMany({
      where: { businessId: { in: accounts.map((a) => a.businessId) } },
    });
    const nameById = new Map(businesses.map((b) => [b.businessId, b.name]));

    return accounts.map((a) => ({
      business_id: a.businessId,
      business_name: nameById.get(a.businessId) ?? '',
    }));
  }

  /** Whitelisted catalog for one business. `403 winger_scope_denied` unless the
   * caller holds an ACTIVE `winger_account` for it. */
  async listProducts(
    userId: string,
    businessId: string,
    query: ListWingerProductsQuery,
  ): Promise<WingerProductPage> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const account = await tx.wingerAccount.findUnique({
        where: { businessId_userId: { businessId, userId } },
      });
      if (!account || account.status !== 'active') {
        throw new ForbiddenException({
          code: 'winger_scope_denied',
          message: 'You are not an active winger for this business',
        });
      }

      const rows = await tx.wingerCatalogProjection.findMany({
        where: {
          isActive: true,
          sellPrice: { not: null },
          ...(query.cursor ? { productId: { gt: query.cursor } } : {}),
        },
        orderBy: { productId: 'asc' },
        take: limit + 1,
      });

      const page = rows.slice(0, limit);
      const nextCursor =
        rows.length > limit ? page[page.length - 1].productId : null;

      return {
        data: page.map((r) => ({
          name: r.name,
          image_url: r.imageUrl,
          price: r.wingerPrice ?? (r.sellPrice as number),
          currency: r.currency ?? 'TZS',
          in_stock: r.onHand > 0,
        })),
        next_cursor: nextCursor,
      };
    });
  }
}
