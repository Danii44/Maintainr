CREATE TABLE `developerSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`projectName` varchar(120) NOT NULL DEFAULT 'Maintainr',
	`logoUrl` text,
	`primaryColor` varchar(16) NOT NULL DEFAULT '#8B5CF6',
	`accentColor` varchar(16) NOT NULL DEFAULT '#22D3EE',
	`emailNotificationsEnabled` boolean NOT NULL DEFAULT true,
	`smsNotificationsEnabled` boolean NOT NULL DEFAULT false,
	`updatedById` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `developerSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `developerSettings_organizationId_unique` UNIQUE(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `maintenanceReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`propertyId` int,
	`unitId` int,
	`assignedToId` int,
	`createdById` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`reminderCadence` enum('ONCE','DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL DEFAULT 'ONCE',
	`dueAt` timestamp NOT NULL,
	`nextRunAt` timestamp NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenanceReminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminders_schedule_uid_idx` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE INDEX `reminders_org_idx` ON `maintenanceReminders` (`organizationId`);--> statement-breakpoint
CREATE INDEX `reminders_next_run_idx` ON `maintenanceReminders` (`nextRunAt`,`isActive`);