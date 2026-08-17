import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
const accounts = {
  manager: "ManagerDemo2026!",
  tenant: "TenantDemo2026!",
  technician: "TechnicianDemo2026!",
  owner: "OwnerDemo2026!",
};
for (const [role, password] of Object.entries(accounts)) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  console.log(`${role}\t${password}\tscrypt$${salt}$${derived.toString("hex")}`);
}
