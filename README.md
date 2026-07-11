# Handy Dandy

Web-first booking platform for smart-home consultations.

## Development

Requirements: Node.js 22+ and npm 11+.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

Open `http://localhost:3000`. The current slice contains the responsive landing
experience and booking-flow placeholder. Google Calendar, Stripe, PostgreSQL,
authentication, and the admin area are intentionally represented by environment
configuration but are not connected yet.

## Repository layout

- `apps/web`: Next.js website and future route handlers
- `packages/domain`: framework-independent booking types and rules
- `reference`: original design reference

See `docs/architecture.md` for system boundaries and delivery order.
