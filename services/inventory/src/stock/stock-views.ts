import type { StockItem, StockMovement } from '#prisma';

export interface StockItemView {
  product_id: string;
  on_hand: number;
  reorder_threshold: number;
  product_active: boolean;
  low_stock: boolean;
  updated_at: string;
}

export interface StockMovementView {
  id: string;
  product_id: string;
  type: string;
  quantity_delta: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

export function toStockItemView(i: StockItem): StockItemView {
  return {
    product_id: i.productId,
    on_hand: i.quantity,
    reorder_threshold: i.reorderThreshold,
    product_active: i.productActive,
    low_stock:
      i.reorderThreshold > 0 &&
      i.productActive &&
      i.quantity <= i.reorderThreshold,
    updated_at: i.updatedAt.toISOString(),
  };
}

export function toMovementView(m: StockMovement): StockMovementView {
  return {
    id: m.id,
    product_id: m.productId,
    type: m.type,
    quantity_delta: m.quantityDelta,
    reason: m.reason,
    reference_type: m.referenceType,
    reference_id: m.referenceId,
    created_by: m.createdBy,
    created_at: m.createdAt.toISOString(),
  };
}
