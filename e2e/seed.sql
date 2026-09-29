-- Fixture data for browser tests. Never used outside local and CI test runs.
INSERT INTO site_settings (key, value, updated_at)
VALUES ('welcome_statement', 'Welcome to the NAISEMA test build.', 0)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

-- One staff administrator per browser project for the admin sign-in journey, reset on every run.
DELETE FROM user WHERE email LIKE 'e2e-admin-%@naisema.test';
DELETE FROM email_outbox;
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
  ('e2e-admin-desktop', 'E2E Admin', 'e2e-admin-desktop-chromium@naisema.test', 0, 0, 0),
  ('e2e-admin-mobile', 'E2E Admin', 'e2e-admin-mobile-chromium@naisema.test', 0, 0, 0);
INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES
  ('e2e-admin-desktop-role', 'e2e-admin-desktop', 'administrator', 'e2e-seed', 0),
  ('e2e-admin-mobile-role', 'e2e-admin-mobile', 'administrator', 'e2e-seed', 0);
