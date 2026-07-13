ALTER TABLE appointments ADD COLUMN calendar_sync_status text NOT NULL DEFAULT 'pending';
ALTER TABLE appointments ADD COLUMN calendar_sync_error text;
ALTER TABLE appointments ADD COLUMN calendar_synced_at timestamptz;

CREATE INDEX appointments_calendar_sync_idx ON appointments(calendar_sync_status, updated_at);
