-- FantasyRealm - starter/reference data (no demo user accounts or credentials)
-- Import into a NEW database AFTER shema.sql.
-- Roles must exist before registration or staff account provisioning.
-- Seed is designed for a fresh database and should be applied ONCE.
-- Passwords and account data are intentionally NOT included in public seed data.

SET NAMES utf8mb4;

INSERT INTO `roles` (`name`) VALUES
  ('USER'),
  ('EMPLOYEE'),
  ('ADMIN');

-- Small starting catalogue for the character creation and accessory pages.
-- These are example names; the app reads equipment IDs dynamically from the DB.
INSERT INTO `accessories` (`name`, `type`, `active`) VALUES
  ('Iron Sword', 'weapon', 1),
  ('Leather Armor', 'armor', 1),
  ('Black Cloak', 'clothing', 1),
  ('Silver Ring', 'accessory', 1);

-- To create test accounts, REGISTER them through the application, then for the
-- private/local testing database only grant EMPLOYEE/ADMIN roles deliberately.
-- Example to run manually in phpMyAdmin after registering YOUR OWN admin account:
-- UPDATE users
-- SET role_id = (SELECT id FROM roles WHERE name = 'ADMIN')
-- WHERE username = 'YOUR_ACTUAL_TEST_ADMIN_USERNAME';
-- Never commit working admin credentials or real users' private data to Git.
