import type { Handler } from "@netlify/functions";
import { handlePortableMaintenanceReminder } from "../../server/reminderScheduler";

export const handler: Handler = async (event) => {
  let statusCode = 200;
  let body = "";
  const response = {
    status(code: number) { statusCode = code; return response; },
    json(value: unknown) { body = JSON.stringify(value); return response; },
  } as any;
  await handlePortableMaintenanceReminder({ headers: event.headers, body: event.body ? JSON.parse(event.body) : {} } as any, response);
  return { statusCode, headers: { "content-type": "application/json" }, body };
};

export const config = {
  schedule: "*/15 * * * *",
};
