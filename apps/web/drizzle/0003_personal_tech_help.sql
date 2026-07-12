INSERT INTO services (id, business_id, name, description, duration_minutes, price_cents)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Personal Tech Help',
  'Patient, judgment-free help with phones, computers, apps, accounts, setup, troubleshooting, and everyday maintenance.',
  60,
  7500
)
ON CONFLICT (id) DO NOTHING;
