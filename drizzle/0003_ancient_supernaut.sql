CREATE TABLE `reminderAcknowledgements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reminderId` int NOT NULL,
	`userId` int NOT NULL,
	`acknowledgedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminderAcknowledgements_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminder_ack_reminder_user_idx` UNIQUE(`reminderId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `reminderRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reminderId` int NOT NULL,
	`occurrenceAt` timestamp NOT NULL,
	`reminderRunStatus` enum('PENDING','SENT') NOT NULL DEFAULT 'PENDING',
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminderRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminder_runs_occurrence_idx` UNIQUE(`reminderId`,`occurrenceAt`)
);
--> statement-breakpoint
ALTER TABLE `developerSettings` MODIFY COLUMN `emailNotificationsEnabled` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `developerSettings` ADD `projectNameArabic` varchar(120) DEFAULT 'Maintainr' NOT NULL;--> statement-breakpoint
CREATE INDEX `reminder_ack_user_idx` ON `reminderAcknowledgements` (`userId`);