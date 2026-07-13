import "server-only";

type EmailMessage = { to: string; subject: string; html: string; text: string };

export async function sendTransactionalEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Handy Dandy <bookings@whatisthis.place>";
  const replyTo = process.env.EMAIL_REPLY_TO ?? "hello@whatisthis.place";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is required in production.");
    console.info("Development email", { ...message, from, replyTo });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, reply_to: replyTo, ...message }),
  });
  if (!response.ok) throw new Error(`Resend rejected an email with status ${response.status}.`);
}

export async function sendPasswordResetEmail(to: string, firstName: string, token: string) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(firstName);
  await sendTransactionalEmail({
    to,
    subject: "Reset your Handy Dandy password",
    text: `Hi ${firstName},\n\nUse this link within 30 minutes to reset your password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${safeName},</p><p>Use the button below within 30 minutes to reset your Handy Dandy password.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#f5f1e8;color:#0b0d16;text-decoration:none;border-radius:6px;font-weight:700">Reset password</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
  });
}

export async function sendPasswordChangedEmail(to: string, firstName: string) {
  await sendTransactionalEmail({
    to,
    subject: "Your Handy Dandy password was changed",
    text: `Hi ${firstName},\n\nYour Handy Dandy password was changed. If this was not you, reply to this email immediately.`,
    html: `<p>Hi ${escapeHtml(firstName)},</p><p>Your Handy Dandy password was changed.</p><p>If this was not you, reply to this email immediately.</p>`,
  });
}

export async function sendBookingConfirmation(to: string, name: string, serviceName: string, startsAt: Date) {
  const formatted = new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: process.env.BUSINESS_TIMEZONE ?? "America/Toronto" }).format(startsAt);
  await sendTransactionalEmail({
    to,
    subject: "Your Handy Dandy appointment is confirmed",
    text: `Hi ${name},\n\nYour ${serviceName} appointment is confirmed for ${formatted}.\n\nReply to this email if you need help.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your <strong>${escapeHtml(serviceName)}</strong> appointment is confirmed for:</p><p style="font-size:18px"><strong>${escapeHtml(formatted)}</strong></p><p>Reply to this email if you need help.</p>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}
