type TicketNotificationEvent = "TICKET_CREATED" | "TICKET_ASSIGNED" | "STATUS_CHANGED" | "TICKET_RESOLVED" | "MAINTENANCE_REMINDER";

type NotificationInput = {
  event: TicketNotificationEvent;
  recipientEmail?: string | null;
  subject: string;
  text: string;
};

export function notificationsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL);
}

export async function sendTicketEmail(input: NotificationInput) {
  if (!input.recipientEmail || !notificationsConfigured()) {
    return { delivered: false, mode: "fallback" as const, reason: "Email credentials or recipient are not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.NOTIFICATION_FROM_EMAIL,
      to: [input.recipientEmail],
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!response.ok) {
    return { delivered: false, mode: "fallback" as const, reason: `Email provider returned ${response.status}` };
  }

  return { delivered: true, mode: "email" as const, event: input.event };
}

export function twilioEnabled() {
  return process.env.TWILIO_ENABLED === "true" && Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function sendTicketSms(input: { recipientPhone?: string | null; text: string }) {
  if (!input.recipientPhone || !twilioEnabled()) return { delivered: false, mode: "fallback" as const, reason: "SMS is disabled or credentials/recipient are not configured" };
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${accountSid}:${process.env.TWILIO_AUTH_TOKEN!}`).toString("base64");
  const body = new URLSearchParams({ To: input.recipientPhone, From: process.env.TWILIO_FROM!, Body: input.text });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) return { delivered: false, mode: "fallback" as const, reason: `SMS provider returned ${response.status}` };
  return { delivered: true, mode: "sms" as const };
}
