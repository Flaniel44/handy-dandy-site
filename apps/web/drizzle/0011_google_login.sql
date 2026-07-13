ALTER TABLE customers ADD COLUMN google_subject text;
CREATE UNIQUE INDEX customers_google_subject_idx ON customers(google_subject);
