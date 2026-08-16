type TicketNotificationEvent = "TICKET_CREATED" | "TICKET_ASSIGNED" | "STATUS_CHANGED" | "TICKET_RESOLVED";

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
