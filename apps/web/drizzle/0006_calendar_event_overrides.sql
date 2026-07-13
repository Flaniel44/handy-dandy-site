CREATE TABLE google_calendar_event_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_settings(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX google_calendar_event_overrides_event_idx
  ON google_calendar_event_overrides(business_id, google_event_id);
