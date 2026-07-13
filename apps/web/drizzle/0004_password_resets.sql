ALTER TABLE customers ADD COLUMN auth_version integer NOT NULL DEFAULT 1;

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX password_reset_tokens_hash_idx ON password_reset_tokens(token_hash);
CREATE INDEX password_reset_tokens_customer_idx ON password_reset_tokens(customer_id, created_at DESC);
