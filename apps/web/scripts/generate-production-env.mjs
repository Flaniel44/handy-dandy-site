import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const webRoot = resolve(import.meta.dirname, "..");
const sourcePath = resolve(webRoot, ".env.local");
const templatePath = resolve(webRoot, ".env.production.example");
const outputPath = resolve(webRoot, ".env.production");

function parseEnv(contents) {
  const values = new Map();

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }

  return values;
}

function serializeValue(value) {
  if (!value) return "";
  if (/^[A-Za-z0-9_./:@+<>=,-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function secret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

const [sourceContents, templateContents] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(templatePath, "utf8"),
]);

const source = parseEnv(sourceContents);
const generated = new Map(source);

generated.set("POSTGRES_DB", "handy_dandy");
generated.set("POSTGRES_USER", "handy_dandy");
generated.set("POSTGRES_PASSWORD", secret(32));
generated.set("HANDY_DANDY_BIND_IP", "10.10.0.2");
generated.set("HANDY_DANDY_PORT", "3010");
generated.set("HANDY_DANDY_ENV_FILE", "apps/web/.env.production");
generated.set("APP_ENCRYPTION_KEY", secret(32));
generated.set("ADMIN_SESSION_SECRET", secret(48));
generated.set("APP_URL", "https://whatisthis.place");
generated.set("BUSINESS_TIMEZONE", source.get("BUSINESS_TIMEZONE") || "America/Toronto");
generated.set("REMINDER_CRON_SECRET", secret(32));
generated.set("REMINDER_WORKER_INTERVAL_MINUTES", "15");
generated.set(
  "GOOGLE_OAUTH_REDIRECT_URI",
  "https://whatisthis.place/api/admin/google-calendar/callback",
);
generated.set("GOOGLE_TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
generated.set(
  "GOOGLE_LOGIN_REDIRECT_URI",
  "https://whatisthis.place/api/auth/google/callback",
);

const output = templateContents
  .split(/\r?\n/)
  .map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) return line;
    return `${match[1]}=${serializeValue(generated.get(match[1]) || "")}`;
  })
  .join("\n")
  .replace(/\n*$/, "\n");

const required = [
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD_HASH",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALENDAR_ID",
];
const missing = required.filter((key) => !generated.get(key));

if (missing.length > 0) {
  console.error(`Production environment was not generated. Missing: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  await writeFile(outputPath, output, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await chmod(outputPath, 0o600);
  console.log("Created apps/web/.env.production with fresh production-only secrets.");
  console.log("Existing email, administrator, contact, and Google credentials were reused.");
}
