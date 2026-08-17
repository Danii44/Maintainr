import { handler as apiHandler } from "../netlify/functions-build/api.js";
import { handler as scheduledHandler } from "../netlify/functions-build/scheduled-maintenanceReminder.js";

const base = { version: "2.0", routeKey: "GET /api/health", rawPath: "/api/health", rawQuery: "", headers: {}, requestContext: { http: { method: "GET", path: "/api/health", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "smoke" } }, isBase64Encoded: false };
const health = await apiHandler({ ...base, path: "/api/health", httpMethod: "GET" }, {});
const dbHealth = await apiHandler({ ...base, path: "/api/health/database", rawPath: "/api/health/database", routeKey: "GET /api/health/database", httpMethod: "GET" }, {});
process.env.REMINDER_CALLBACK_SECRET = "smoke-secret";
const scheduled = await scheduledHandler({ ...base, path: "/api/scheduled/portableMaintenanceReminder", rawPath: "/api/scheduled/portableMaintenanceReminder", routeKey: "POST /api/scheduled/portableMaintenanceReminder", httpMethod: "POST", headers: { "content-type": "application/json" }, body: "{}" }, {});
const summary = { healthStatus: health?.statusCode, healthBody: health?.body, databaseHealthStatus: dbHealth?.statusCode, databaseHealthBody: dbHealth?.body, scheduledWithoutSecretStatus: scheduled?.statusCode };
console.log(JSON.stringify(summary, null, 2));
if (health?.statusCode !== 200 || dbHealth?.statusCode === undefined || scheduled?.statusCode !== 403) process.exit(1);
