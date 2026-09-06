-- Business name + currency snapshot source, projected from tenancy.BusinessCreated.
-- Internal: no RLS (worker/consumer writes; the receipt handler reads it unscoped).
CREATE TABLE "sales_business" (
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',

    CONSTRAINT "sales_business_pkey" PRIMARY KEY ("business_id")
);
