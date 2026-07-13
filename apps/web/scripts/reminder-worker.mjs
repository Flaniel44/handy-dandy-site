const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.REMINDER_CRON_SECRET;
const intervalMinutes = Number(process.env.REMINDER_WORKER_INTERVAL_MINUTES ?? "15");

if (!secret) throw new Error("REMINDER_CRON_SECRET is required for the reminder worker.");
if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1) throw new Error("REMINDER_WORKER_INTERVAL_MINUTES must be at least 1.");

async function run() {
  try {
    const response = await fetch(`${appUrl}/api/internal/reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Reminder endpoint returned ${response.status}: ${body}`);
    console.info("Appointment reminders processed", body);
  } catch (error) {
    console.error("Appointment reminder worker failed", error);
  } finally {
    setTimeout(run, intervalMinutes * 60_000);
  }
}

void run();
