-- Open-invoice projection for the overdue sweep. Internal worker state (no RLS),
-- fed from sales InvoiceIssued / InvoicePaymentRecorded / InvoiceVoided.
CREATE TABLE "overdue_invoice" (
    "invoice_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_email" TEXT,
    "number" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "balance_due_minor" INTEGER NOT NULL,
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "overdue_invoice_pkey" PRIMARY KEY ("invoice_id")
);

CREATE INDEX "overdue_invoice_business_id_due_date_idx" ON "overdue_invoice"("business_id", "due_date");
CREATE INDEX "overdue_invoice_business_id_customer_id_idx" ON "overdue_invoice"("business_id", "customer_id");
