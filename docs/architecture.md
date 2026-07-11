# Architecture

## Direction

Build a modular monolith with PostgreSQL as the source of truth. The responsive
Next.js application is the first client. A separate HTTP API can be extracted when
the Expo mobile application begins; domain rules stay in `packages/domain`.

## Availability

Availability is computed as weekly working hours minus manual blocks, active booking
holds, confirmed appointments, and timed Google Calendar events. All appointment
instants are stored as UTC timestamps. Weekly hours are wall-clock values interpreted
in the configured IANA business timezone.

The server must recheck availability before creating a short-lived payment hold.
PostgreSQL must enforce non-overlap for active holds and appointments using timestamp
ranges and an exclusion constraint. A Stripe webhook, not the browser redirect,
confirms payment idempotently. Confirmation then queues Calendar write-back and email.

## Planned services

- `web`: landing page, booking flow, customer history, admin interface
- `api`: availability and appointment commands shared by web/mobile
- `worker`: hold expiry, email, Calendar reconciliation
- `postgres`: appointments, customers, schedules, OAuth connection, audit log
- `caddy`: TLS and reverse proxy

## Delivery slices

1. Landing page and accessible interaction
2. Database schema and tested availability engine
3. Guest booking and admin-created appointments
4. Stripe Checkout and webhook idempotency
5. Google OAuth, timed-event reads, and confirmed-event write-back
6. Email, rescheduling, customer accounts, and admin hardening
7. Expo mobile client
