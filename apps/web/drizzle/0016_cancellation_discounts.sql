ALTER TABLE "appointments"
ADD COLUMN "cancellation_discount_percent" smallint;

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_cancellation_discount_percent_check"
CHECK (
  "cancellation_discount_percent" IS NULL
  OR "cancellation_discount_percent" BETWEEN 1 AND 100
);
