-- CreateTable
CREATE TABLE "low_stock_alert_state" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "opened_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "low_stock_alert_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "low_stock_alert_state_business_id_product_id_key" ON "low_stock_alert_state"("business_id", "product_id");

-- Row-Level Security (same helper as the init migration)
SELECT enable_tenant_rls('low_stock_alert_state', 'business_id');

-- Retire the boolean edge flag; `low_stock_alert_state` is now the source of
-- truth. Any product currently low re-emits one StockFellBelowThreshold on its
-- next movement, which is the correct notification behaviour.
ALTER TABLE "stock_item" DROP COLUMN "low_stock_open";
