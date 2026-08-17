import express from "express";
import { createServer } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleMaintenanceReminder, handlePortableMaintenanceReminder } from "../reminderScheduler";
import { registerHealthRoutes } from "../health";

export function createApp() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerHealthRoutes(app);
  app.post("/api/scheduled/maintenanceReminder", handleMaintenanceReminder);
  app.post("/api/scheduled/portableMaintenanceReminder", handlePortableMaintenanceReminder);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return { app, server };
}
