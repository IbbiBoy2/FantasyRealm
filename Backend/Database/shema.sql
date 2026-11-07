-- FantasyRealm - relational database schema
-- Source: structure-only phpMyAdmin export supplied on 2026-11-01.
-- Verified tables: accessories, appearances, characters, character_accessories,
--                  contact_messages, reviews, roles, users.
--
-- Import ONLY into a NEW EMPTY MariaDB/MySQL database selected in phpMyAdmin.
-- Do NOT import this into your working XAMPP fantasyrealm database.
-- No CREATE/DROP DATABASE and no DROP TABLE commands are included.
-- Existing tables will produce errors instead of being overwritten.
-- Does NOT include account records or any personal data.
-- SQL events are supplied separately in maintenance-events.sql.

SET NAMES utf8mb4;

CREATE TABLE `accessories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `image_path` VARCHAR(255) DEFAULT NULL,
  `body_image_path` VARCHAR(255) DEFAULT NULL,
  `type` varchar(50) NOT NULL,
  `gender` VARCHAR(10) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `appearances` (
  `id` int(11) NOT NULL,
  `character_id` int(11) NOT NULL,
  `hair_style` varchar(50) NOT NULL,
  `eye_shape` varchar(50) NOT NULL,
  `nose_shape` varchar(50) NOT NULL,
  `mouth_shape` varchar(50) NOT NULL,
  `skin_color` varchar(50) NOT NULL,
  `hair_color` varchar(50) NOT NULL,
  `eye_color` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `characters` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `gender` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `rejection_reason` varchar(1000) DEFAULT NULL,
  `shared` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `image_path` varchar(255) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `character_accessories` (
  `character_id` int(11) NOT NULL,
  `accessory_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `contact_messages` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `reviews` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `character_id` int(11) NOT NULL,
  `rating` int(11) NOT NULL,
  `comment` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `suspended` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `reset_token_hash` varchar(255) DEFAULT NULL,
  `reset_token_expires_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `login_rate_limits` (
  `rate_key` varchar(80) NOT NULL,
  `attempt_count` int unsigned NOT NULL DEFAULT 0,
  `window_started_at` datetime NOT NULL,
  PRIMARY KEY (`rate_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE character_moderation_decisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  character_id INT NOT NULL,
  character_name VARCHAR(100) NOT NULL,
  owner_user_id INT NOT NULL,
  actor_user_id INT NOT NULL,
  decision VARCHAR(20) NOT NULL,
  rejection_reason VARCHAR(1000) NOT NULL,
  decided_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_moderation_character (character_id),
  KEY idx_moderation_decided_at (decided_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE character_staff_deletions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  character_id INT NOT NULL,
  character_name VARCHAR(100) NOT NULL,
  owner_user_id INT NOT NULL,
  actor_user_id INT NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_staff_deletion_character (character_id),
  KEY idx_staff_deletion_date (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `accessories`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `appearances`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `character_id` (`character_id`);

ALTER TABLE `characters`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `user_id` (`user_id`);

ALTER TABLE `character_accessories`
  ADD PRIMARY KEY (`character_id`,`accessory_id`),
  ADD KEY `accessory_id` (`accessory_id`);

ALTER TABLE `contact_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

ALTER TABLE `reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `character_id` (`character_id`);

ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `role_id` (`role_id`);

ALTER TABLE `accessories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `appearances`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `characters`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `contact_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `appearances`
  ADD CONSTRAINT `appearances_ibfk_1` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`);

ALTER TABLE `characters`
  ADD CONSTRAINT `characters_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `character_accessories`
  ADD CONSTRAINT `character_accessories_ibfk_1` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`),
  ADD CONSTRAINT `character_accessories_ibfk_2` FOREIGN KEY (`accessory_id`) REFERENCES `accessories` (`id`);

ALTER TABLE `contact_messages`
  ADD CONSTRAINT `contact_messages_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `reviews`
  ADD CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`);

ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`);