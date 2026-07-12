# Handy Dandy

Web-first booking platform for smart-home consultations and personal technology help.

## Development

Requirements: Node.js 22+ and npm 11+.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
docker compose up -d postgres
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. The current slice contains the responsive landing
experience and a database-backed guest booking flow. PostgreSQL stores services,
working hours, blocks, customers, holds, and appointments. Guest bookings are confirmed
without online payment. The protected admin area manages schedules, vacations, clients,
appointments, and notes. Optional customer accounts provide appointment history and
customer-editable notes. Google Calendar and payments are not connected yet.

## Database commands

- `docker compose up -d postgres`: start the local PostgreSQL service
- `npm run db:migrate`: apply committed migrations
- `npm run db:generate`: generate a migration after changing the Drizzle schema
- `npm run db:studio`: inspect local data using Drizzle Studio
- `docker compose down`: stop local services without deleting database data

The initial migration seeds a 60-minute consultation and Monday-to-Friday working
hours from 9:00 AM to 5:00 PM in `America/Toronto`. These values can be changed at `/admin`.

## Admin credentials

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and a random `ADMIN_SESSION_SECRET` of at
least 32 characters in `apps/web/.env.local`. Generate a password hash with:

```bash
npm run admin:hash-password --workspace=@handy-dani/web -- "your-long-password"
```

The admin session is stored in a signed, HTTP-only cookie. Production cookies require HTTPS.

## Repository layout

- `apps/web`: Next.js website and future route handlers
- `apps/web/components/landing-scene.tsx`: production landing-page interaction
- `apps/web/components/landing-scene-markup.ts`: app-owned SVG scene markup
- `apps/web/lib/db`: Drizzle schema and database connection
- `apps/web/drizzle`: committed PostgreSQL migrations
- `packages/domain`: framework-independent booking types and rules
- `reference`: design references only; production code never reads from this folder

See `docs/architecture.md` for system boundaries and delivery order.
