import type { Product } from '#prisma';
import type { MembershipRole } from '../tenant/roles.decorator.js';

export interface ProductView {
  id: string;
  business_id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit: string;
  image_url: string | null;
  sell_price: number;
  winger_price: number | null;
  currency: string;
  reorder_threshold: number;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Present for Owner only. */
  cost_price?: number;
}

/**
 * Serialises a product for the API. `cost_price` is Owner-only — Staff responses
 * never include it (see api-contract.md acceptance criteria).
 */
export function toProductView(
  product: Product,
  role: MembershipRole,
): ProductView {
  const view: ProductView = {
    id: product.id,
    business_id: product.businessId,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category_id: product.categoryId,
    unit: product.unit,
    image_url: product.imageUrl,
    sell_price: product.sellPrice,
    winger_price: product.wingerPrice,
    currency: product.currency,
    reorder_threshold: product.reorderThreshold,
    code: product.code,
    is_active: product.isActive,
    created_at: product.createdAt.toISOString(),
    updated_at: product.updatedAt.toISOString(),
  };
  if (role === 'owner') {
    view.cost_price = product.costPrice;
  }
  return view;
}
