-- Maintainr cleanup: remove seeded QA data but preserve the four demo login accounts.
-- Review the target organization name before running in Supabase.
-- Run this only in the demo database, inside Supabase SQL Editor.

BEGIN;

DO $$
DECLARE
  v_org_id integer;
  v_property_id integer;
  v_unit_id integer;
  v_ticket_id integer;
BEGIN
  SELECT "id" INTO v_org_id
  FROM "organizations"
  WHERE "name" = 'Maintainr Demo Organization'
  ORDER BY "id"
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'Maintainr Demo Organization was not found; no seeded data was removed.';
    RETURN;
  END IF;

  SELECT "id" INTO v_ticket_id
  FROM "tickets"
  WHERE "organizationId" = v_org_id
    AND "title" = 'Demo leaking kitchen tap';

  IF v_ticket_id IS NOT NULL THEN
    DELETE FROM "ticketMedia" WHERE "ticketId" = v_ticket_id;
    DELETE FROM "ticketLogs" WHERE "ticketId" = v_ticket_id;
    DELETE FROM "tickets" WHERE "id" = v_ticket_id;
  END IF;

  DELETE FROM "maintenanceReminders"
  WHERE "organizationId" = v_org_id
    AND "title" = 'Demo filter inspection';

  DELETE FROM "developerSettings" WHERE "organizationId" = v_org_id;

  SELECT "id" INTO v_property_id
  FROM "properties"
  WHERE "organizationId" = v_org_id
    AND "name" = 'Demo Residence';

  IF v_property_id IS NOT NULL THEN
    SELECT "id" INTO v_unit_id
    FROM "units"
    WHERE "propertyId" = v_property_id
      AND "unitNumber" = '101';

    IF v_unit_id IS NOT NULL THEN
      UPDATE "users" SET "unitId" = NULL
      WHERE "openId" IN ('demo_tenant_2026', 'demo_owner_2026');

      UPDATE "units"
      SET "ownerId" = NULL, "currentTenantId" = NULL
      WHERE "id" = v_unit_id;
    END IF;

    DELETE FROM "units" WHERE "propertyId" = v_property_id;
    DELETE FROM "properties" WHERE "id" = v_property_id;
  END IF;

  RAISE NOTICE 'Seeded QA records removed. Demo login rows were preserved.';
END $$;

COMMIT;

SELECT "name", "email", "role", "organizationId", "unitId"
FROM "users"
WHERE "openId" IN ('demo_manager_2026', 'demo_tenant_2026', 'demo_technician_2026', 'demo_owner_2026')
ORDER BY "role";
