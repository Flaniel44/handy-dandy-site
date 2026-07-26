CREATE TABLE guest_booking_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES booking_slots(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  client_notes text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX guest_booking_confirmations_slot_idx
  ON guest_booking_confirmations(slot_id);
CREATE UNIQUE INDEX guest_booking_confirmations_token_idx
  ON guest_booking_confirmations(token_hash);
CREATE INDEX guest_booking_confirmations_expires_idx
  ON guest_booking_confirmations(expires_at);
