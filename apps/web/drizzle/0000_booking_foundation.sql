CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE slot_state AS ENUM ('held', 'confirmed', 'released', 'expired');
CREATE TYPE appointment_status AS ENUM ('pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show');

CREATE TABLE business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Toronto',
  slot_interval_minutes integer NOT NULL DEFAULT 30 CHECK (slot_interval_minutes > 0),
  minimum_notice_minutes integer NOT NULL DEFAULT 120 CHECK (minimum_notice_minutes >= 0),
  booking_window_days integer NOT NULL DEFAULT 60 CHECK (booking_window_days > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_settings(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE weekly_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_settings(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at_local time NOT NULL,
  ends_at_local time NOT NULL,
  CHECK (starts_at_local < ends_at_local)
);
CREATE INDEX weekly_hours_business_weekday_idx ON weekly_hours(business_id, weekday);

CREATE TABLE manual_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_settings(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT 'Unavailable',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);
CREATE INDEX manual_blocks_time_idx ON manual_blocks(starts_at, ends_at);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  phone text,
  user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_email_idx ON customers(email);

CREATE TABLE booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  state slot_state NOT NULL DEFAULT 'held',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  CHECK (state <> 'held' OR expires_at IS NOT NULL)
);
CREATE INDEX booking_slots_time_idx ON booking_slots(starts_at, ends_at);
ALTER TABLE booking_slots ADD CONSTRAINT booking_slots_no_active_overlap
  EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (state IN ('held', 'confirmed'));

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL UNIQUE REFERENCES booking_slots(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  status appointment_status NOT NULL DEFAULT 'pending_payment',
  notes text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'web',
  stripe_checkout_session_id text UNIQUE,
  google_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_settings(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,
  encrypted_refresh_token text NOT NULL,
  sync_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO business_settings (id, name, timezone)
VALUES ('11111111-1111-4111-8111-111111111111', 'Handy Dandy', 'America/Toronto');

INSERT INTO services (id, business_id, name, description, duration_minutes, price_cents)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Smart-home consultation',
  'A practical one-on-one consultation tailored to your home.',
  60,
  12500
);

INSERT INTO weekly_hours (business_id, weekday, starts_at_local, ends_at_local)
SELECT '11111111-1111-4111-8111-111111111111', weekday, '09:00', '17:00'
FROM generate_series(1, 5) AS weekday;
