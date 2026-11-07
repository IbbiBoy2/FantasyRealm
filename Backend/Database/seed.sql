-- FantasyRealm - initial reference data
-- Import into a new database after shema.sql.
-- Equipment is managed by employees through the application.
-- No demonstration accounts or accessories are preloaded.

SET NAMES utf8mb4;

-- Required application roles.
INSERT INTO `roles` (`name`) VALUES
  ('USER'),
  ('EMPLOYEE'),
  ('ADMIN');

-- Accessories are created by employees using the dashboard.
-- No default accessories are inserted.

