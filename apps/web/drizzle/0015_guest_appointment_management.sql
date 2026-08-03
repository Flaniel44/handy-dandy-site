CREATE TABLE guest_appointment_management_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX guest_appointment_management_tokens_appointment_idx
  ON guest_appointment_management_tokens(appointment_id);
CREATE UNIQUE INDEX guest_appointment_management_tokens_hash_idx
  ON guest_appointment_management_tokens(token_hash);
CREATE INDEX guest_appointment_management_tokens_expires_idx
  ON guest_appointment_management_tokens(expires_at);
