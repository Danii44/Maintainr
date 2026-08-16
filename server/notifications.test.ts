import { describe, expect, it, afterEach } from "vitest";
import { notificationsConfigured, sendTicketEmail, twilioEnabled } from "./notifications";

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.NOTIFICATION_FROM_EMAIL;
  delete process.env.TWILIO_ENABLED;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM;
});

describe("notification configuration", () => {
  it("falls back safely when email credentials are absent", async () => {
    expect(notificationsConfigured()).toBe(false);
    await expect(sendTicketEmail({ event: "TICKET_CREATED", recipientEmail: "resident@example.com", subject: "New ticket", text: "Created" })).resolves.toMatchObject({ delivered: false, mode: "fallback" });
  });

  it("does not enable Twilio unless explicitly configured", () => {
    expect(twilioEnabled()).toBe(false);
    process.env.TWILIO_ENABLED = "true";
    process.env.TWILIO_ACCOUNT_SID = "sid";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM = "+10000000000";
    expect(twilioEnabled()).toBe(true);
  });
});
