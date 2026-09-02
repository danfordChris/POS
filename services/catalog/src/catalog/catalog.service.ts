import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma, Product } from '#prisma';
import { OutboxWriter } from '@pos/nest-common';
import { SCHEMA_VERSION, SUBJECTS, makeEnvelope } from '@pos/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MembershipRole } from '../tenant/roles.decorator.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQuery } from './dto/list-products.query.js';
import { ProductView, toProductView } from './product-view.js';

const outbox = new OutboxWriter();
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export interface ProductPage {
  data: ProductView[];
  next_cursor: string | null;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Categories ─────────────────────────────────────────────────────────────

  async listCategories(businessId: string): Promise<Category[]> {
    return this.prisma.runInTenantContext(businessId, (tx) =>
      tx.category.findMany({ orderBy: { name: 'asc' } }),
    );
  }

  async createCategory(
    businessId: string,
    dto: CreateCategoryDto,
  ): Promise<Category> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      let category: Category;
      try {
        category = await tx.category.create({
          data: { businessId, name: dto.name.trim() },
        });
      } catch (error) {
        throw this.rethrowUnique(
          error,
          'A category with this name already exists',
        );
      }
      await outbox.write(tx, {
        subject: SUBJECTS.catalog.categoryUpserted,
        payload: this.envelope(businessId, {
          business_id: businessId,
          category_id: category.id,
          name: category.name,
        }),
      });
      return category;
    });
  }

  // ── Products ───────────────────────────────────────────────────────────────

  async listProducts(
    businessId: string,
    role: MembershipRole,
    query: ListProductsQuery,
  ): Promise<ProductPage> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    return this.prisma.runInTenantContext(businessId, async (tx) => {
      // Scan lookup: an explicit `code` is an exact match; a miss is a 404 that
      // echoes the scanned value (api-contract.md).
      if (query.code !== undefined) {
        const hit = await tx.product.findFirst({ where: { code: query.code } });
        if (!hit) {
          throw new NotFoundException({
            code: 'not_found',
            message: 'No product matches that code',
            devMessage: `No product with code=${query.code} in this business`,
            details: [{ field: 'code', issue: query.code }],
          });
        }
        return { data: [toProductView(hit, role)], next_cursor: null };
      }

      const where: Prisma.ProductWhereInput = {};
      if (query.category_id) where.categoryId = query.category_id;
      if (query.active !== undefined) where.isActive = query.active === 'true';
      if (query.q) {
        where.OR = [
          { name: { contains: query.q, mode: 'insensitive' } },
          { sku: { contains: query.q, mode: 'insensitive' } },
        ];
      }
      if (query.cursor) where.id = { gt: query.cursor };

      const rows = await tx.product.findMany({
        where,
        orderBy: { id: 'asc' },
        take: limit + 1,
      });
      const page = rows.slice(0, limit);
      const next = rows.length > limit ? page[page.length - 1].id : null;
      return {
        data: page.map((p) => toProductView(p, role)),
        next_cursor: next,
      };
    });
  }

  async getProduct(
    businessId: string,
    role: MembershipRole,
    id: string,
  ): Promise<ProductView> {
    const product = await this.prisma.runInTenantContext(businessId, (tx) =>
      tx.product.findUnique({ where: { id } }),
    );
    if (!product) {
      throw new NotFoundException({
        code: 'not_found',
        message: 'Product not found',
      });
    }
    return toProductView(product, role);
  }

  async createProduct(
    businessId: string,
    role: MembershipRole,
    dto: CreateProductDto,
  ): Promise<ProductView> {
    const prices = this.pricesFor(role, dto);

    return this.prisma.runInTenantContext(businessId, async (tx) => {
      let product: Product;
      try {
        product = await tx.product.create({
          data: {
            businessId,
            sku: dto.sku.trim(),
            name: dto.name.trim(),
            description: dto.description ?? null,
            categoryId: dto.category_id ?? null,
            unit: dto.unit?.trim() || 'each',
            code: dto.code?.trim() || null,
            reorderThreshold: dto.reorder_threshold ?? 0,
            ...prices,
          },
        });
      } catch (error) {
        throw this.rethrowUnique(
          error,
          'A product with this SKU or code already exists',
        );
      }

      await this.emitProductUpserted(tx, businessId, product);
      if (prices.sellPrice !== undefined || prices.wingerPrice !== undefined) {
        await this.emitPriceChanged(tx, businessId, product);
      }
      return toProductView(product, role);
    });
  }

  async updateProduct(
    businessId: string,
    role: MembershipRole,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductView> {
    const prices = this.pricesFor(role, dto);

    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const before = await tx.product.findUnique({ where: { id } });
      if (!before) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Product not found',
        });
      }

      const data: Prisma.ProductUpdateInput = { ...prices };
      if (dto.name !== undefined) data.name = dto.name.trim();
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.unit !== undefined) data.unit = dto.unit.trim() || 'each';
      if (dto.code !== undefined) data.code = dto.code.trim() || null;
      if (dto.reorder_threshold !== undefined)
        data.reorderThreshold = dto.reorder_threshold;
      if (dto.is_active !== undefined) data.isActive = dto.is_active;
      if (dto.category_id !== undefined)
        data.category = { connect: { id: dto.category_id } };

      let product: Product;
      try {
        product = await tx.product.update({ where: { id }, data });
      } catch (error) {
        throw this.rethrowUnique(
          error,
          'A product with this SKU or code already exists',
        );
      }

      await this.emitProductUpserted(tx, businessId, product);
      const priceMoved =
        product.sellPrice !== before.sellPrice ||
        product.wingerPrice !== before.wingerPrice;
      if (priceMoved) await this.emitPriceChanged(tx, businessId, product);
      if (before.isActive && !product.isActive)
        await this.emitProductDeactivated(tx, businessId, product.id);

      return toProductView(product, role);
    });
  }

  async setProductImage(
    businessId: string,
    role: MembershipRole,
    id: string,
    imageUrl: string,
  ): Promise<ProductView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      try {
        const product = await tx.product.update({
          where: { id },
          data: { imageUrl },
        });
        await this.emitProductUpserted(tx, businessId, product);
        return toProductView(product, role);
      } catch (error) {
        if (this.isNotFound(error)) {
          throw new NotFoundException({
            code: 'not_found',
            message: 'Product not found',
          });
        }
        throw error;
      }
    });
  }

  async deactivateProduct(
    businessId: string,
    role: MembershipRole,
    id: string,
  ): Promise<ProductView> {
    return this.prisma.runInTenantContext(businessId, async (tx) => {
      const before = await tx.product.findUnique({ where: { id } });
      if (!before) {
        throw new NotFoundException({
          code: 'not_found',
          message: 'Product not found',
        });
      }
      if (!before.isActive) return toProductView(before, role);

      const product = await tx.product.update({
        where: { id },
        data: { isActive: false },
      });
      await this.emitProductUpserted(tx, businessId, product);
      await this.emitProductDeactivated(tx, businessId, product.id);
      return toProductView(product, role);
    });
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Price columns to write — empty for Staff (silently dropped, server is authority). */
  private pricesFor(
    role: MembershipRole,
    dto: { cost_price?: number; sell_price?: number; winger_price?: number },
  ): { costPrice?: number; sellPrice?: number; wingerPrice?: number } {
    if (role !== 'owner') return {};
    const out: {
      costPrice?: number;
      sellPrice?: number;
      wingerPrice?: number;
    } = {};
    if (dto.cost_price !== undefined) out.costPrice = dto.cost_price;
    if (dto.sell_price !== undefined) out.sellPrice = dto.sell_price;
    if (dto.winger_price !== undefined) out.wingerPrice = dto.winger_price;
    return out;
  }

  private envelope(businessId: string, payload: unknown) {
    return makeEnvelope({
      producer: 'catalog',
      businessId,
      schemaVersion: SCHEMA_VERSION,
      payload,
    });
  }

  private async emitProductUpserted(
    tx: Prisma.TransactionClient,
    businessId: string,
    product: Product,
  ): Promise<void> {
    await outbox.write(tx, {
      subject: SUBJECTS.catalog.productUpserted,
      payload: this.envelope(businessId, {
        business_id: businessId,
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        is_active: product.isActive,
        reorder_threshold: product.reorderThreshold,
      }),
    });
  }

  private async emitPriceChanged(
    tx: Prisma.TransactionClient,
    businessId: string,
    product: Product,
  ): Promise<void> {
    await outbox.write(tx, {
      subject: SUBJECTS.catalog.priceChanged,
      payload: this.envelope(businessId, {
        business_id: businessId,
        product_id: product.id,
        sell_price: product.sellPrice,
        winger_price: product.wingerPrice,
        currency: product.currency,
      }),
    });
  }

  private async emitProductDeactivated(
    tx: Prisma.TransactionClient,
    businessId: string,
    productId: string,
  ): Promise<void> {
    await outbox.write(tx, {
      subject: SUBJECTS.catalog.productDeactivated,
      payload: this.envelope(businessId, {
        business_id: businessId,
        product_id: productId,
      }),
    });
  }

  private isNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  private rethrowUnique(error: unknown, message: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException({ code: 'conflict', message });
    }
    return error;
  }
}
