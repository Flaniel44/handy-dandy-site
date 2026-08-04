UPDATE business_settings
SET name = 'Digital HandyDan', updated_at = now()
WHERE id = '11111111-1111-4111-8111-111111111111'
  AND name IN ('Handy Dandy', 'Digital Handyman', 'Digital HandyDan');
