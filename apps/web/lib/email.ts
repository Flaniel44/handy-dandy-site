import "server-only";

type EmailMessage = { to: string; subject: string; html: string; text: string };
type AdminAppointmentDetails = {
  appointmentId: string;
  status: string;
  source: string;
  clientNotes: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  streetAddress: string | null;
  unit: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
};
const MAX_DELIVERY_ATTEMPTS = 3;

export async function sendTransactionalEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Digital Handyman <dan@digitalhandydan.ca>";
  const replyTo = process.env.EMAIL_REPLY_TO ?? "dan@digitalhandydan.ca";

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
    subject: "Reset your Digital Handyman password",
    text: `Hi ${firstName},\n\nUse this link within 30 minutes to reset your password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${safeName},</p><p>Use the button below within 30 minutes to reset your Digital Handyman password.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#f5f1e8;color:#0b0d16;text-decoration:none;border-radius:6px;font-weight:700">Reset password</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
  });
}

export async function sendPasswordChangedEmail(to: string, firstName: string) {
  await sendTransactionalEmail({
    to,
    subject: "Your Digital Handyman password was changed",
    text: `Hi ${firstName},\n\nYour Digital Handyman password was changed. If this was not you, reply to this email immediately.`,
    html: `<p>Hi ${escapeHtml(firstName)},</p><p>Your Digital Handyman password was changed.</p><p>If this was not you, reply to this email immediately.</p>`,
  });
}

export async function sendBookingConfirmation(to: string, name: string, serviceName: string, startsAt: Date, manageUrl?: string) {
  const formatted = new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: process.env.BUSINESS_TIMEZONE ?? "America/Toronto" }).format(startsAt);
  const demosUrl = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/demos`;
  const manageText = manageUrl ? `\n\nNeed to make a change? Reschedule or cancel here:\n${manageUrl}` : "";
  const manageHtml = manageUrl ? `<p><a href="${escapeHtml(manageUrl)}">Reschedule or cancel this appointment</a></p>` : "";
  await sendTransactionalEmail({
    to,
    subject: "Your Digital Handyman appointment is confirmed",
    text: `Hi ${name},\n\nYour ${serviceName} appointment is confirmed for ${formatted}.${manageText}\n\nReply to this email if you need help.\n\nTake a look at some examples of what's possible!\n${demosUrl}`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your <strong>${escapeHtml(serviceName)}</strong> appointment is confirmed for:</p><p style="font-size:18px"><strong>${escapeHtml(formatted)}</strong></p>${manageHtml}<p>Reply to this email if you need help.</p><p style="margin-top:28px"><a href="${escapeHtml(demosUrl)}">Take a look at some examples of what's possible!</a></p>`,
  });
}

export async function sendBookingRequestReceived(to: string, name: string, serviceName: string, startsAt: Date, manageUrl: string) {
  const formatted = formatAppointmentTime(startsAt);
  await sendTransactionalEmail({
    to,
    subject: "Your Digital Handyman appointment request was received",
    text: `Hi ${name},\n\nWe received your request for a ${serviceName} appointment on ${formatted}. Your time is being held while Digital Handyman reviews it, but the appointment is not confirmed yet.\n\nYou will receive another email after the request is approved or declined.\n\nReview, reschedule, or cancel your request:\n${manageUrl}`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>We received your request for a <strong>${escapeHtml(serviceName)}</strong> appointment on:</p><p style="font-size:18px"><strong>${escapeHtml(formatted)}</strong></p><p>Your time is being held while Digital Handyman reviews it, but the appointment is <strong>not confirmed yet</strong>.</p><p>You will receive another email after the request is approved or declined.</p><p><a href="${escapeHtml(manageUrl)}">Review, reschedule, or cancel your request</a></p>`,
  });
}

export async function sendGuestBookingVerification(
  to: string,
  name: string,
  serviceName: string,
  startsAt: Date,
  token: string,
) {
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const confirmationUrl = `${appUrl}/book/confirm?token=${encodeURIComponent(token)}`;
  const formatted = formatAppointmentTime(startsAt);
  await sendTransactionalEmail({
    to,
    subject: "Confirm your Digital Handyman appointment",
    text: `Hi ${name},\n\nPlease confirm your ${serviceName} appointment for ${formatted} within 15 minutes:\n${confirmationUrl}\n\nThe appointment will not be added to the calendar until you confirm it. If you did not request this, you can ignore this email.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Please confirm your <strong>${escapeHtml(serviceName)}</strong> appointment for:</p><p style="font-size:18px"><strong>${escapeHtml(formatted)}</strong></p><p><a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;padding:12px 18px;background:#f5f1e8;color:#0b0d16;text-decoration:none;border-radius:6px;font-weight:700">Review and confirm appointment</a></p><p>This link expires in 15 minutes. The appointment will not be added to the calendar until you confirm it.</p><p>If you did not request this, you can safely ignore this email.</p>`,
  });
}

export async function sendAppointmentCancelled(
  to: string,
  name: string,
  serviceName: string,
  startsAt: Date,
  rebookUrl?: string,
  cancellationNotes?: string,
  cancellationDiscountPercent?: number,
) {
  const formatted = formatAppointmentTime(startsAt);
  const rebookText = rebookUrl ? `\n\nChoose another time:\n${rebookUrl}` : "";
  const rebookHtml = rebookUrl ? `<p><a href="${escapeHtml(rebookUrl)}">Choose another appointment time</a></p>` : "";
  const notes = cancellationNotes?.trim();
  const notesText = notes ? `\n\nNote from Digital Handyman:\n${notes}` : "";
  const notesHtml = notes ? `<p><strong>Note from Digital Handyman:</strong><br>${escapeHtml(notes).replaceAll("\n", "<br>")}</p>` : "";
  const discountText = cancellationDiscountPercent
    ? `\n\nWe are very sorry for having to cancel your appointment. Please accept a ${cancellationDiscountPercent}% discount if you decide to reschedule. Your discount has been recorded and will be honoured.`
    : "";
  const discountHtml = cancellationDiscountPercent
    ? `<p><strong>We are very sorry for having to cancel your appointment.</strong> Please accept a <strong>${cancellationDiscountPercent}% discount</strong> if you decide to reschedule. Your discount has been recorded and will be honoured.</p>`
    : "";
  await sendTransactionalEmail({
    to, subject: "Your Digital Handyman appointment was cancelled",
    text: `Hi ${name},\n\nYour ${serviceName} appointment for ${formatted} has been cancelled.${notesText}${discountText}${rebookText}`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your <strong>${escapeHtml(serviceName)}</strong> appointment for ${escapeHtml(formatted)} has been cancelled.</p>${notesHtml}${discountHtml}${rebookHtml}`,
  });
}

export async function sendAdminAppointmentBooked(details: AdminAppointmentDetails) {
  await sendAdminAppointmentUpdate("booked", details);
}

export async function sendAdminAppointmentCancelled(details: AdminAppointmentDetails) {
  await sendAdminAppointmentUpdate("cancelled", details);
}

export async function sendAppointmentRescheduled(to: string, name: string, serviceName: string, previousStartsAt: Date, startsAt: Date, manageUrl?: string) {
  const previousFormatted = formatAppointmentTime(previousStartsAt);
  const formatted = formatAppointmentTime(startsAt);
  await sendTransactionalEmail({
    to, subject: "Your Digital Handyman appointment was rescheduled",
    text: `Hi ${name},\n\nYour ${serviceName} appointment was moved from ${previousFormatted} to ${formatted}.${manageUrl ? `\n\nMake another change:\n${manageUrl}` : ""}\n\nReply to this email if you need help.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your <strong>${escapeHtml(serviceName)}</strong> appointment was rescheduled.</p><p><span style="text-decoration:line-through">${escapeHtml(previousFormatted)}</span><br><strong style="font-size:18px">${escapeHtml(formatted)}</strong></p>${manageUrl ? `<p><a href="${escapeHtml(manageUrl)}">Reschedule or cancel this appointment</a></p>` : ""}<p>Reply to this email if you need help.</p>`,
  });
}

export async function sendCustomerAppointmentReminder(to: string, name: string, serviceName: string, startsAt: Date) {
  const formatted = formatAppointmentTime(startsAt);
  await sendTransactionalEmail({
    to,
    subject: "Reminder: your Digital Handyman appointment is tomorrow",
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

async function sendAdminAppointmentUpdate(action: "booked" | "cancelled", details: AdminAppointmentDetails) {
  const to = process.env.ADMIN_EMAIL ?? process.env.EMAIL_FAILURE_ALERT_TO;
  if (!to) throw new Error("ADMIN_EMAIL or EMAIL_FAILURE_ALERT_TO is required for appointment notifications.");
  const startsAt = formatAppointmentTime(details.startsAt);
  const endsAt = new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone: process.env.BUSINESS_TIMEZONE ?? "America/Toronto" }).format(details.endsAt);
  const address = formatCustomerAddress(details);
  const pendingApproval = action === "booked" && details.status === "pending_approval";
  const heading = action === "cancelled" ? "Client cancelled appointment" : pendingApproval ? "New appointment request awaiting approval" : "New appointment booked";
  const reviewDestination = `/admin?appointment=${encodeURIComponent(details.appointmentId)}#appointment-${details.appointmentId}`;
  const reviewUrl = pendingApproval ? `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/login?next=${encodeURIComponent(reviewDestination)}` : "";
  const fields = [
    ["Client", details.customerName],
    ["Email", details.customerEmail],
    ["Phone", details.customerPhone || "Not provided"],
    ["Address", address || "Not provided"],
    ["Service", details.serviceName],
    ["When", `${startsAt} to ${endsAt}`],
    ["Client notes", details.clientNotes || "None provided"],
    ["Booking source", details.source],
    ["Appointment ID", details.appointmentId],
  ] as const;
  const text = [heading, "", ...fields.map(([label, value]) => `${label}: ${value}`), reviewUrl && `Review request: ${reviewUrl}`].filter(Boolean).join("\n");
  const html = `<p><strong>${escapeHtml(heading)}</strong></p><table style="border-collapse:collapse">${fields.map(([label, value]) => `<tr><td style="padding:4px 14px 4px 0;vertical-align:top;color:#666"><strong>${escapeHtml(label)}</strong></td><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("")}</table>${reviewUrl ? `<p><a href="${escapeHtml(reviewUrl)}">Review and approve or decline this request</a></p>` : ""}`;
  await sendTransactionalEmail({
    to,
    subject: action === "booked" ? `${pendingApproval ? "Approval needed" : "New booking"}: ${details.customerName} — ${details.serviceName}` : `Cancellation: ${details.customerName} — ${details.serviceName}`,
    text,
    html,
  });
}

function formatCustomerAddress(details: AdminAppointmentDetails) {
  const street = [details.streetAddress, details.unit && `Unit ${details.unit}`].filter(Boolean).join(", ");
  const locality = [details.city, details.postalCode].filter(Boolean).join(" ");
  return [street, locality, details.country].filter(Boolean).join(", ");
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
      `Digital Handyman could not deliver an email after ${attempts} attempt${attempts === 1 ? "" : "s"}.`,
      `Customer: ${original.to}`,
      `Subject: ${original.subject}`,
      `Failure: ${failure.message}`,
      "",
      "Please contact the customer manually with this message:",
      "",
      original.text,
    ].join("\n"),
    html: `<p><strong>Digital Handyman could not deliver an email after ${attempts} attempt${attempts === 1 ? "" : "s"}.</strong></p><p>Customer: ${escapeHtml(original.to)}<br>Subject: ${escapeHtml(original.subject)}<br>Failure: ${escapeHtml(failure.message)}</p><p>Please contact the customer manually with this message:</p><pre style="white-space:pre-wrap">${escapeHtml(original.text)}</pre>`,
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
