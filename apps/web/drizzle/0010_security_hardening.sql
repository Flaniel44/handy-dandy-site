CREATE TABLE rate_limit_buckets (
  key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  window_started_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_created_at_idx ON audit_log (created_at DESC);
