# Architecture

## Direction

Build a modular monolith with PostgreSQL as the source of truth. The responsive
Next.js application is the first client. A separate HTTP API can be extracted when
the Expo mobile application begins; domain rules stay in `packages/domain`.

## Availability

Availability is computed as weekly working hours minus manual blocks, active booking
holds (reserved for possible future payment flows), confirmed appointments, and timed Google Calendar events. All appointment
instants are stored as UTC timestamps. Weekly hours are wall-clock values interpreted
in the configured IANA business timezone.

The server rechecks availability before creating an appointment, and PostgreSQL enforces
non-overlap for active slots using timestamp ranges and an exclusion constraint. Guest
and admin-created bookings are currently confirmed without online payment. If payments
are introduced later, confirmation must move to an idempotent payment webhook rather
than trusting a browser redirect.

## Planned services

- `web`: landing page, booking flow, customer history, admin interface
- `api`: availability and appointment commands shared by web/mobile
- `worker`: hold expiry, email, Calendar reconciliation
- `postgres`: appointments, customers, schedules, OAuth connection, audit log
- `caddy`: TLS and reverse proxy

## Delivery slices

1. Landing page and accessible interaction (complete)
2. Database schema and tested availability engine (complete)
3. Guest booking and admin-created appointments (complete foundation)
4. Payments and webhook idempotency (deferred; appointments currently pay offline)
5. Google OAuth, timed-event reads, and confirmed-event write-back
6. Email, rescheduling, customer accounts, and admin hardening
7. Expo mobile client
