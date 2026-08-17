import type { Handler } from "@netlify/functions";
import { cleanupExpiredDemoSessions } from "../../server/demoCleanup";

export const handler: Handler = async () => {
  try {
    const result = await cleanupExpiredDemoSessions();
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true, ...result }) };
  } catch (error) {
    return { statusCode: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Demo cleanup failed" }) };
  }
};

export const config = {
  schedule: "0 3 * * *",
};
