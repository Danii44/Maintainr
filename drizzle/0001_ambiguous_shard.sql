CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`subscriptionTier` enum('STARTER','GROWTH','ENTERPRISE') NOT NULL DEFAULT 'STARTER',
	`stripeCustomerId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text NOT NULL,
	`totalUnits` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticketLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`actorId` int NOT NULL,
	`action` varchar(64) NOT NULL,
	`message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticketLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticketMedia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`uploadedById` int NOT NULL,
	`mediaUrl` text NOT NULL,
	`mediaType` enum('IMAGE','VIDEO') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticketMedia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`unitId` int NOT NULL,
	`submittedById` int NOT NULL,
	`assignedToId` int,
	`category` enum('PLUMBING','ELECTRICAL','HVAC','APPLIANCE','OTHER') NOT NULL,
	`priority` enum('LOW','MEDIUM','HIGH','EMERGENCY') NOT NULL DEFAULT 'MEDIUM',
	`status` enum('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`preferredAccessTime` varchar(255),
	`resolutionNotes` text,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`unitNumber` varchar(32) NOT NULL,
	`floorNumber` int NOT NULL DEFAULT 1,
	`accessCode` varchar(6) NOT NULL,
	`ownerId` int,
	`currentTenantId` int,
	CONSTRAINT `units_id` PRIMARY KEY(`id`),
	CONSTRAINT `units_accessCode_unique` UNIQUE(`accessCode`),
	CONSTRAINT `units_property_number_idx` UNIQUE(`propertyId`,`unitNumber`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('PROPERTY_MANAGER','TENANT','TECHNICIAN','FLAT_OWNER') NOT NULL DEFAULT 'TENANT';--> statement-breakpoint
ALTER TABLE `users` ADD `clerkUserId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `unitId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_clerkUserId_unique` UNIQUE(`clerkUserId`);--> statement-breakpoint
CREATE INDEX `properties_org_idx` ON `properties` (`organizationId`);--> statement-breakpoint
CREATE INDEX `ticket_logs_ticket_idx` ON `ticketLogs` (`ticketId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ticket_media_ticket_idx` ON `ticketMedia` (`ticketId`);--> statement-breakpoint
CREATE INDEX `tickets_org_status_idx` ON `tickets` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `tickets_assignee_idx` ON `tickets` (`assignedToId`);--> statement-breakpoint
CREATE INDEX `tickets_priority_idx` ON `tickets` (`priority`);--> statement-breakpoint
CREATE INDEX `users_org_role_idx` ON `users` (`organizationId`,`role`);--> statement-breakpoint
CREATE INDEX `users_unit_idx` ON `users` (`unitId`);