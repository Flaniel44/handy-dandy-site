ALTER TABLE appointments ADD COLUMN customer_reminder_sent_at timestamptz;
ALTER TABLE appointments ADD COLUMN admin_reminder_sent_at timestamptz;

CREATE INDEX appointments_reminder_due_idx
  ON appointments(status, customer_reminder_sent_at, admin_reminder_sent_at);
