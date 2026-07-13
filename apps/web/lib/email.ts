import "server-only";

type EmailMessage = { to: string; subject: string; html: string; text: string };
const MAX_DELIVERY_ATTEMPTS = 3;

export async function sendTransactionalEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Handy Dandy <bookings@whatisthis.place>";
  const replyTo = process.env.EMAIL_REPLY_TO ?? "hello@whatisthis.place";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is required in production.");
    console.info("Development email", { ...message, from, replyTo });
    return;
  }

  let failure: Error | undefined;
  let attempts = 0;
  for (attempts = 1; attempts <= MAX_DELIVERY_ATTEMPTS; attempts += 1) {
    try {
      const response = await deliverEmail(apiKey, from, replyTo, message);
      if (response.ok) return;
      failure = new EmailDeliveryError(response.status);
      if (!isRetryableStatus(response.status)) break;
    } catch (error) {
      failure = error instanceof Error ? error : new Error("Unknown email delivery failure.");
    }
    if (attempts < MAX_DELIVERY_ATTEMPTS) await retryDelay(attempts);
  }

  const finalFailure = failure ?? new Error("Unknown email delivery failure.");
  await alertDeliveryFailure(apiKey, from, replyTo, message, Math.min(attempts, MAX_DELIVERY_ATTEMPTS), finalFailure);
  throw finalFailure;
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

export async function sendAppointmentCancelled(to: string, name: string, serviceName: string, startsAt: Date) {
  const formatted = formatAppointmentTime(startsAt);
  await sendTransactionalEmail({
    to, subject: "Your Handy Dandy appointment was cancelled",
    text: `Hi ${name},\n\nYour ${serviceName} appointment for ${formatted} has been cancelled.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your <strong>${escapeHtml(serviceName)}</strong> appointment for ${escapeHtml(formatted)} has been cancelled.</p>`,
  });
}

export async function sendAppointmentRescheduled(to: string, name: string, serviceName: string, previousStartsAt: Date, startsAt: Date) {
  const previousFormatted = formatAppointmentTime(previousStartsAt);
  const formatted = formatAppointmentTime(startsAt);
  await sendTransactionalEmail({
    to, subject: "Your Handy Dandy appointment was rescheduled",
    text: `Hi ${name},\n\nYour ${serviceName} appointment was moved from ${previousFormatted} to ${formatted}.\n\nReply to this email if you need help.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your <strong>${escapeHtml(serviceName)}</strong> appointment was rescheduled.</p><p><span style="text-decoration:line-through">${escapeHtml(previousFormatted)}</span><br><strong style="font-size:18px">${escapeHtml(formatted)}</strong></p><p>Reply to this email if you need help.</p>`,
  });
}

export async function sendCustomerAppointmentReminder(to: string, name: string, serviceName: string, startsAt: Date) {
  const formatted = formatAppointmentTime(startsAt);
  await sendTransactionalEmail({
    to,
    subject: "Reminder: your Handy Dandy appointment is tomorrow",
    text: `Hi ${name},\n\nThis is a reminder that your ${serviceName} appointment is scheduled for ${formatted}.\n\nReply to this email if you need help.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>This is a reminder that your <strong>${escapeHtml(serviceName)}</strong> appointment is scheduled for:</p><p style="font-size:18px"><strong>${escapeHtml(formatted)}</strong></p><p>Reply to this email if you need help.</p>`,
  });
}

export async function sendAdminAppointmentReminder(
  to: string,
  customerName: string,
  customerEmail: string,
  serviceName: string,
  startsAt: Date,
  notes: string,
) {
  const formatted = formatAppointmentTime(startsAt);
  const details = [`Client: ${customerName} <${customerEmail}>`, `Service: ${serviceName}`, `Time: ${formatted}`, notes && `Notes: ${notes}`].filter(Boolean);
  await sendTransactionalEmail({
    to,
    subject: `Reminder: ${customerName} is booked tomorrow`,
    text: details.join("\n"),
    html: `<p><strong>You have an appointment tomorrow.</strong></p><p>Client: ${escapeHtml(customerName)} &lt;${escapeHtml(customerEmail)}&gt;<br>Service: ${escapeHtml(serviceName)}<br>Time: ${escapeHtml(formatted)}</p>${notes ? `<p>Notes: ${escapeHtml(notes)}</p>` : ""}`,
  });
}

function formatAppointmentTime(startsAt: Date) {
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: process.env.BUSINESS_TIMEZONE ?? "America/Toronto" }).format(startsAt);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}

async function deliverEmail(apiKey: string, from: string, replyTo: string, message: EmailMessage) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, reply_to: replyTo, ...message }),
  });
}

async function alertDeliveryFailure(
  apiKey: string,
  from: string,
  replyTo: string,
  original: EmailMessage,
  attempts: number,
  failure: Error,
) {
  const alertTo = process.env.EMAIL_FAILURE_ALERT_TO ?? process.env.ADMIN_EMAIL;
  if (!alertTo) {
    console.error("Email delivery failed and no alert recipient is configured", { to: original.to, subject: original.subject, attempts, failure });
    return;
  }
  const alert: EmailMessage = {
    to: alertTo,
    subject: `Action required: email to ${original.to} failed`,
    text: [
      `Handy Dandy could not deliver an email after ${attempts} attempt${attempts === 1 ? "" : "s"}.`,
      `Customer: ${original.to}`,
      `Subject: ${original.subject}`,
      `Failure: ${failure.message}`,
      "",
      "Please contact the customer manually with this message:",
      "",
      original.text,
    ].join("\n"),
    html: `<p><strong>Handy Dandy could not deliver an email after ${attempts} attempt${attempts === 1 ? "" : "s"}.</strong></p><p>Customer: ${escapeHtml(original.to)}<br>Subject: ${escapeHtml(original.subject)}<br>Failure: ${escapeHtml(failure.message)}</p><p>Please contact the customer manually with this message:</p><pre style="white-space:pre-wrap">${escapeHtml(original.text)}</pre>`,
  };
  try {
    const response = await deliverEmail(apiKey, from, replyTo, alert);
    if (!response.ok) throw new EmailDeliveryError(response.status);
  } catch (alertError) {
    console.error("Unable to send the email delivery failure alert", alertError);
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function retryDelay(failedAttempt: number) {
  if (process.env.NODE_ENV === "test") return;
  await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** (failedAttempt - 1))));
}

class EmailDeliveryError extends Error {
  constructor(status: number) {
    super(`Resend rejected an email with status ${status}.`);
    this.name = "EmailDeliveryError";
  }
}
