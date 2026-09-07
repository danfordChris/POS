-- Phase 07 — invoicing and credit sales.
-- Adds customer / invoice / invoice_line / payment / invoice_number_counter to
-- the `sales` schema, plus `payment_terms` + `customer_id` on `sale`.
-- `invoice` gets a RELAXED-read RLS policy (public `GET /v1/i/{token}` runs with
-- no tenant context); every write path stays strictly tenant-scoped.

-- AlterTable
ALTER TABLE "sale"
    ADD COLUMN "payment_terms" TEXT NOT NULL DEFAULT 'cash',
    ADD COLUMN "customer_id" UUID;

-- CreateTable
CREATE TABLE "customer" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "tax_id" TEXT,
    "outstanding_balance" INTEGER NOT NULL DEFAULT 0,
    "disabled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "sale_id" UUID,
    "customer_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "currency" TEXT NOT NULL,
    "subtotal_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "tax_minor" INTEGER NOT NULL DEFAULT 0,
    "total_minor" INTEGER NOT NULL,
    "amount_paid_minor" INTEGER NOT NULL DEFAULT 0,
    "balance_due_minor" INTEGER NOT NULL,
    "issue_date" TIMESTAMPTZ(6) NOT NULL,
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "public_token" TEXT NOT NULL,
    "business_name_snapshot" TEXT NOT NULL,
    "void_reason" TEXT,
    "document_url" TEXT,
    "document_generated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "invoice_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "product_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "line_total_minor" INTEGER NOT NULL,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_number_counter" (
    "business_id" UUID NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_number_counter_pkey" PRIMARY KEY ("business_id")
);

-- CreateIndex
CREATE INDEX "customer_business_id_name_idx" ON "customer"("business_id", "name");
CREATE UNIQUE INDEX "invoice_sale_id_key" ON "invoice"("sale_id");
CREATE UNIQUE INDEX "invoice_public_token_key" ON "invoice"("public_token");
CREATE UNIQUE INDEX "invoice_business_id_number_key" ON "invoice"("business_id", "number");
CREATE INDEX "invoice_business_id_status_due_date_idx" ON "invoice"("business_id", "status", "due_date");
CREATE INDEX "invoice_business_id_customer_id_idx" ON "invoice"("business_id", "customer_id");
CREATE INDEX "invoice_line_business_id_invoice_id_idx" ON "invoice_line"("business_id", "invoice_id");
CREATE INDEX "payment_business_id_invoice_id_idx" ON "payment"("business_id", "invoice_id");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Row-Level Security ───────────────────────────────────────────────────────
-- Strict tenant isolation for customer / invoice_line / payment / counter.
SELECT enable_tenant_rls('customer', 'business_id');
SELECT enable_tenant_rls('invoice_line', 'business_id');
SELECT enable_tenant_rls('payment', 'business_id');
SELECT enable_tenant_rls('invoice_number_counter', 'business_id');

-- `invoice` — relaxed READ so the unauthenticated `GET /v1/i/{token}` handler
-- (no `app.business_id`) can look an invoice up by its unguessable token; every
-- WRITE stays strictly scoped. Mirrors the receipt/sale/sale_line policy.
ALTER TABLE "invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoice"
    USING (
        nullif(current_setting('app.business_id', true), '') IS NULL
        OR business_id = nullif(current_setting('app.business_id', true), '')::uuid
    )
    WITH CHECK (
        business_id = nullif(current_setting('app.business_id', true), '')::uuid
    );
