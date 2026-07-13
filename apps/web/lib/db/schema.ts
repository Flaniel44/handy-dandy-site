import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const slotState = pgEnum("slot_state", ["held", "confirmed", "released", "expired"]);
export const appointmentStatus = pgEnum("appointment_status", [
  "pending_payment",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export const businessSettings = pgTable("business_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Toronto"),
  slotIntervalMinutes: integer("slot_interval_minutes").notNull().default(30),
  minimumNoticeMinutes: integer("minimum_notice_minutes").notNull().default(120),
  bookingWindowDays: integer("booking_window_days").notNull().default(60),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessSettings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weeklyHours = pgTable("weekly_hours", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessSettings.id, { onDelete: "cascade" }),
  weekday: smallint("weekday").notNull(),
  startsAtLocal: time("starts_at_local").notNull(),
  endsAtLocal: time("ends_at_local").notNull(),
}, (table) => [index("weekly_hours_business_weekday_idx").on(table.businessId, table.weekday)]);

export const manualBlocks = pgTable("manual_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessSettings.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason").notNull().default("Unavailable"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("manual_blocks_time_idx").on(table.startsAt, table.endsAt)]);

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  address: text("address"),
  streetAddress: text("street_address"),
  unit: text("unit"),
  city: text("city"),
  postalCode: text("postal_code"),
  country: text("country"),
  passwordHash: text("password_hash"),
  authVersion: integer("auth_version").notNull().default(1),
  userId: text("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("customers_email_idx").on(table.email)]);

export const bookingSlots = pgTable("booking_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  state: slotState("state").notNull().default("held"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("booking_slots_time_idx").on(table.startsAt, table.endsAt)]);

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  slotId: uuid("slot_id").notNull().references(() => bookingSlots.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  status: appointmentStatus("status").notNull().default("pending_payment"),
  notes: text("notes").notNull().default(""),
  clientNotes: text("client_notes").notNull().default(""),
  source: text("source").notNull().default("web"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  googleEventId: text("google_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("appointments_slot_idx").on(table.slotId),
  uniqueIndex("appointments_stripe_session_idx").on(table.stripeCheckoutSessionId),
]);

export const googleCalendarConnections = pgTable("google_calendar_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessSettings.id, { onDelete: "cascade" }),
  calendarId: text("calendar_id").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  syncToken: text("sync_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("password_reset_tokens_hash_idx").on(table.tokenHash)]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
