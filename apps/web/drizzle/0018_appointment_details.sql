ALTER TABLE guest_booking_confirmations
  ADD COLUMN appointment_mode text NOT NULL DEFAULT 'phone',
  ADD COLUMN appointment_phone text,
  ADD COLUMN appointment_street_address text,
  ADD COLUMN appointment_unit text,
  ADD COLUMN appointment_city text,
  ADD COLUMN appointment_postal_code text,
  ADD COLUMN appointment_country text;

ALTER TABLE appointments
  ADD COLUMN appointment_mode text NOT NULL DEFAULT 'phone',
  ADD COLUMN appointment_phone text,
  ADD COLUMN appointment_street_address text,
  ADD COLUMN appointment_unit text,
  ADD COLUMN appointment_city text,
  ADD COLUMN appointment_postal_code text,
  ADD COLUMN appointment_country text;

UPDATE services
SET description = 'A one-on-one planning session to understand your home, goals, existing devices, and budget. We will identify practical automations, compatibility concerns, privacy choices, and clear next steps without pressuring you to buy anything.'
WHERE id = '22222222-2222-4222-8222-222222222222'
  AND description = 'A practical one-on-one consultation tailored to your home.';

UPDATE services
SET description = 'Patient, judgment-free help setting up, troubleshooting, or maintaining phones, computers, apps, accounts, Wi-Fi, printers, backups, and everyday technology. We can solve one problem or make a simple plan for several.'
WHERE id = '33333333-3333-4333-8333-333333333333'
  AND description = 'Patient, judgment-free help with phones, computers, apps, accounts, setup, troubleshooting, and everyday maintenance.';
