ALTER TABLE customers ADD COLUMN first_name text;
ALTER TABLE customers ADD COLUMN last_name text;
ALTER TABLE customers ADD COLUMN address text;
ALTER TABLE customers ADD COLUMN password_hash text;
ALTER TABLE appointments ADD COLUMN client_notes text NOT NULL DEFAULT '';

UPDATE customers
SET first_name = split_part(name, ' ', 1),
    last_name = CASE WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1) ELSE '' END
WHERE first_name IS NULL;
