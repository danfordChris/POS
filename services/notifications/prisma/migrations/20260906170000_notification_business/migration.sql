-- Business name + default locale, projected from tenancy.BusinessCreated.
-- Used to render alert emails. Internal: no RLS.
CREATE TABLE "notification_business" (
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_business_pkey" PRIMARY KEY ("business_id")
);
