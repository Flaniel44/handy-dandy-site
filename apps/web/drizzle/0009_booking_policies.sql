ALTER TABLE business_settings ADD COLUMN appointment_buffer_minutes integer NOT NULL DEFAULT 60;
ALTER TABLE business_settings ADD COLUMN cancellation_notice_minutes integer NOT NULL DEFAULT 0;
