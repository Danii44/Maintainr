-- Maintainr disposable demo data for portal QA.
-- Run only in a demo/non-production PostgreSQL database.
-- This creates four separate accounts with different passwords.
-- Replace the example emails before running if desired.

BEGIN;

DO $$
DECLARE
  v_org_id integer;
  v_property_id integer;
  v_unit_id integer;
  v_manager_id integer;
  v_tenant_id integer;
  v_technician_id integer;
  v_owner_id integer;
  v_ticket_id integer;
BEGIN
  SELECT "id" INTO v_org_id FROM "organizations" WHERE "name" = 'Maintainr Demo Organization' ORDER BY "id" LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO "organizations" ("name", "subscriptionTier")
    VALUES ('Maintainr Demo Organization', 'STARTER')
    RETURNING "id" INTO v_org_id;
  END IF;

  INSERT INTO "users" ("openId", "organizationId", "name", "email", "passwordHash", "role", "loginMethod")
  VALUES
    ('demo_manager_2026', v_org_id, 'Demo Property Manager', 'manager.demo@maintainr.test', 'scrypt$01b2a927e956cb6a8d5134a71d6ffeb0$12085b60e2c3f84b9373592c3bbde7e1ef9b98d7b051b84af4197d6cb0f1316569b1f885ec047b70a9d0eb3d89710b192d8e952e1f7eb8a35b690c4f59ee39aa', 'PROPERTY_MANAGER', 'password'),
    ('demo_tenant_2026', v_org_id, 'Demo Tenant', 'tenant.demo@maintainr.test', 'scrypt$53ec8a87f2288b4438f7ddc651f9e225$26ddb431cf95563601ff4670dc964108e39928e23a55ad478e75987d7e07c876407de1142a4405e5ab9fc27d67f819df3c638765bed3b0079f844b48679ae636', 'TENANT', 'password'),
    ('demo_technician_2026', v_org_id, 'Demo Technician', 'technician.demo@maintainr.test', 'scrypt$ec5285e417f8fe769ebc3d87d3d4e403$22c3e08c06c3d2b1cba6945cca7380fd893b67dfb93011c44a499bc13be0d8300865b19ed053372646c16e798e93b5200ae78ec82eaa7386fa2c4049acbf8f18', 'TECHNICIAN', 'password'),
    ('demo_owner_2026', v_org_id, 'Demo Flat Owner', 'owner.demo@maintainr.test', 'scrypt$d9c6d69e38cc3e855622988ea4c1f026$258c29dc0673772744edbe805ac92de6b30a73fef51b8d7f9dcd8a1c67d41cb04ac1351df7ac3578069f2a7c5f5316f146e8f4d91abca57d818b718c20e94acb', 'FLAT_OWNER', 'password')
  ON CONFLICT ("openId") DO UPDATE SET
    "organizationId" = EXCLUDED."organizationId",
    "name" = EXCLUDED."name",
    "email" = EXCLUDED."email",
    "passwordHash" = EXCLUDED."passwordHash",
    "role" = EXCLUDED."role",
    "loginMethod" = EXCLUDED."loginMethod",
    "updatedAt" = now();

  SELECT "id" INTO v_manager_id FROM "users" WHERE "openId" = 'demo_manager_2026';
  SELECT "id" INTO v_tenant_id FROM "users" WHERE "openId" = 'demo_tenant_2026';
  SELECT "id" INTO v_technician_id FROM "users" WHERE "openId" = 'demo_technician_2026';
  SELECT "id" INTO v_owner_id FROM "users" WHERE "openId" = 'demo_owner_2026';

  SELECT "id" INTO v_property_id FROM "properties" WHERE "organizationId" = v_org_id AND "name" = 'Demo Residence' ORDER BY "id" LIMIT 1;
  IF v_property_id IS NULL THEN
    INSERT INTO "properties" ("organizationId", "name", "address", "totalUnits")
    VALUES (v_org_id, 'Demo Residence', '1 Maintainr Avenue', 1)
    RETURNING "id" INTO v_property_id;
  END IF;

  SELECT "id" INTO v_unit_id FROM "units" WHERE "propertyId" = v_property_id AND "unitNumber" = '101' LIMIT 1;
  IF v_unit_id IS NULL THEN
    INSERT INTO "units" ("propertyId", "unitNumber", "floorNumber", "accessCode")
    VALUES (v_property_id, '101', 1, '260817')
    RETURNING "id" INTO v_unit_id;
  END IF;

  UPDATE "units" SET "ownerId" = v_owner_id, "currentTenantId" = v_tenant_id WHERE "id" = v_unit_id;
  UPDATE "users" SET "unitId" = v_unit_id WHERE "id" IN (v_tenant_id, v_owner_id);

  SELECT "id" INTO v_ticket_id FROM "tickets" WHERE "organizationId" = v_org_id AND "title" = 'Demo leaking kitchen tap' ORDER BY "id" LIMIT 1;
  IF v_ticket_id IS NULL THEN
    INSERT INTO "tickets" ("organizationId", "unitId", "submittedById", "assignedToId", "category", "priority", "status", "title", "description", "preferredAccessTime")
    VALUES (v_org_id, v_unit_id, v_tenant_id, v_technician_id, 'PLUMBING', 'HIGH', 'ASSIGNED', 'Demo leaking kitchen tap', 'Demo ticket for checking Manager, Tenant, and Technician portals.', 'Weekdays 09:00-12:00')
    RETURNING "id" INTO v_ticket_id;
    INSERT INTO "ticketLogs" ("ticketId", "actorId", "action", "message")
    VALUES (v_ticket_id, v_tenant_id, 'CREATED', 'Demo ticket created for portal QA');
    INSERT INTO "ticketLogs" ("ticketId", "actorId", "action", "message")
    VALUES (v_ticket_id, v_manager_id, 'ASSIGNED', 'Demo technician assigned for portal QA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "maintenanceReminders" WHERE "organizationId" = v_org_id AND "title" = 'Demo filter inspection') THEN
    INSERT INTO "maintenanceReminders" ("organizationId", "propertyId", "unitId", "assignedToId", "createdById", "title", "description", "cadence", "dueAt", "nextRunAt")
    VALUES (v_org_id, v_property_id, v_unit_id, v_tenant_id, v_manager_id, 'Demo filter inspection', 'Demo reminder for checking reminder lists and acknowledgement.', 'ONCE', now() + interval '14 days', now() + interval '14 days');
  END IF;

  INSERT INTO "developerSettings" ("organizationId", "projectName", "projectNameArabic", "primaryColor", "accentColor", "emailNotificationsEnabled", "smsNotificationsEnabled", "updatedById")
  VALUES (v_org_id, 'Maintainr Demo', 'Maintainr تجريبي', '#8B5CF6', '#22D3EE', false, false, v_manager_id)
  ON CONFLICT ("organizationId") DO UPDATE SET
    "projectName" = EXCLUDED."projectName",
    "projectNameArabic" = EXCLUDED."projectNameArabic",
    "updatedById" = EXCLUDED."updatedById",
    "updatedAt" = now();
END $$;

COMMIT;

-- Verify the four accounts and seeded QA records.
SELECT "name", "email", "role", "organizationId", "unitId"
FROM "users"
WHERE "openId" IN ('demo_manager_2026', 'demo_tenant_2026', 'demo_technician_2026', 'demo_owner_2026')
ORDER BY "role";
