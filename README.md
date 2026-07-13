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
customer-editable notes. The admin can connect Google Calendar through OAuth; timed
events block availability and confirmed appointments sync back. Payments are not connected yet.

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

## Transactional email and password resets

Development emails are written to the server console when `RESEND_API_KEY` is empty. For production,
verify `whatisthis.place` in Resend and configure `RESEND_API_KEY`, `APP_URL`, `EMAIL_FROM`, and
`EMAIL_REPLY_TO`. Password-reset links expire after 30 minutes and invalidate existing customer sessions.
Booking confirmation emails are sent after a reservation is committed, so an email delivery failure never
cancels a valid appointment.

Incoming addresses such as `hello@whatisthis.place` can be forwarded to a personal Gmail account with
Cloudflare Email Routing. Configure the same address under Gmail's **Send mail as** setting using Resend's
SMTP host so manual replies retain the business address.

## Google Calendar

Enable the Google Calendar API and create a Web application OAuth client. Configure
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_ID`,
`GOOGLE_OAUTH_REDIRECT_URI`, and a base64-encoded 32-byte `GOOGLE_TOKEN_ENCRYPTION_KEY`.
The redirect URI must exactly match `/api/admin/google-calendar/callback` on the running app.
Connect or disconnect from the admin dashboard. Refresh tokens are encrypted at rest;
changing the encryption key requires reconnecting the calendar.

## Repository layout

- `apps/web`: Next.js website and future route handlers
- `apps/web/components/landing-scene.tsx`: production landing-page interaction
- `apps/web/components/landing-scene-markup.ts`: app-owned SVG scene markup
- `apps/web/lib/db`: Drizzle schema and database connection
- `apps/web/drizzle`: committed PostgreSQL migrations
- `packages/domain`: framework-independent booking types and rules
- `reference`: design references only; production code never reads from this folder

See `docs/architecture.md` for system boundaries and delivery order.
