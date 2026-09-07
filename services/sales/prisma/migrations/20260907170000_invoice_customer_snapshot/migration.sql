-- The public `GET /v1/i/{token}` handler runs with no tenant context and cannot
-- join `customer` (strict RLS). Snapshot the customer name onto the invoice at
-- issue time, exactly like `business_name_snapshot`.
ALTER TABLE "invoice" ADD COLUMN "customer_name_snapshot" TEXT NOT NULL DEFAULT '';
ALTER TABLE "invoice" ALTER COLUMN "customer_name_snapshot" DROP DEFAULT;

-- Carry the business locale on the sales_business projection so InvoiceIssued
-- can tell notifications which language to render the invoice email in.
ALTER TABLE "sales_business" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';

-- `GET /v1/i/{token}` renders the line items with no tenant context, so
-- `invoice_line` needs the same RELAXED read as `invoice` / `receipt` /
-- `sale_line`; every WRITE stays strictly tenant-scoped.
DROP POLICY IF EXISTS tenant_isolation ON "invoice_line";
CREATE POLICY tenant_isolation ON "invoice_line"
    USING (
        nullif(current_setting('app.business_id', true), '') IS NULL
        OR business_id = nullif(current_setting('app.business_id', true), '')::uuid
    )
    WITH CHECK (
        business_id = nullif(current_setting('app.business_id', true), '')::uuid
    );
