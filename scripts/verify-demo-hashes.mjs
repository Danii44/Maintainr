import { readFile } from "node:fs/promises";
import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
const sql = await readFile(new URL("../DEMO_ACCOUNTS_SEED.sql", import.meta.url), "utf8");
const cases = [
  ["manager.demo@maintainr.test", "ManagerDemo2026!"],
  ["tenant.demo@maintainr.test", "TenantDemo2026!"],
  ["technician.demo@maintainr.test", "TechnicianDemo2026!"],
  ["owner.demo@maintainr.test", "OwnerDemo2026!"],
];
for (const [email, password] of cases) {
  const row = sql.split("\n").find((line) => line.includes(`'${email}'`));
  if (!row) throw new Error(`Missing ${email}`);
  const encoded = row.match(/'(scrypt\$[^']+)'/)[1];
  const [, salt, expectedHex] = encoded.split("$");
  const actual = await scrypt(password, salt, expectedHex.length / 2);
  if (!timingSafeEqual(Buffer.from(expectedHex, "hex"), actual)) throw new Error(`Hash mismatch for ${email}: expected ${expectedHex}, actual ${actual.toString("hex")}`);
  console.log(`verified ${email}`);
}
