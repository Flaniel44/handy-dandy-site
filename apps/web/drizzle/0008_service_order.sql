ALTER TABLE services ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY business_id ORDER BY created_at, id) - 1 AS position
  FROM services
)
UPDATE services
SET sort_order = ranked.position
FROM ranked
WHERE services.id = ranked.id;
