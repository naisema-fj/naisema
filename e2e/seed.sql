-- Fixture data for browser tests. Never used outside local and CI test runs.
INSERT INTO site_settings (key, value, updated_at)
VALUES ('welcome_statement', 'Welcome to the Na iSema test build.', 0)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

-- One staff administrator per browser project for the admin sign-in journey, reset on every run.
DELETE FROM user WHERE email LIKE 'e2e-admin-%@naisema.test';
DELETE FROM email_outbox;
-- Sign-in links sent by earlier local runs count towards the per-address limit; forget them.
DELETE FROM audit_event WHERE object_id LIKE 'e2e-%';
DELETE FROM rate_limit;
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
  ('e2e-admin-desktop', 'E2E Admin', 'e2e-admin-desktop-chromium@naisema.test', 0, 0, 0),
  ('e2e-admin-mobile', 'E2E Admin', 'e2e-admin-mobile-chromium@naisema.test', 0, 0, 0);
INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES
  ('e2e-admin-desktop-role', 'e2e-admin-desktop', 'administrator', 'e2e-seed', 0),
  ('e2e-admin-mobile-role', 'e2e-admin-mobile', 'administrator', 'e2e-seed', 0);

-- One editor per browser project for the article journey, and a topic to tag articles with.
DELETE FROM user WHERE email LIKE 'e2e-editor-%@naisema.test';
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
  ('e2e-editor-desktop', 'E2E Editor', 'e2e-editor-desktop-chromium@naisema.test', 0, 0, 0),
  ('e2e-editor-mobile', 'E2E Editor', 'e2e-editor-mobile-chromium@naisema.test', 0, 0, 0);
INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES
  ('e2e-editor-desktop-role', 'e2e-editor-desktop', 'editor', 'e2e-seed', 0),
  ('e2e-editor-mobile-role', 'e2e-editor-mobile', 'editor', 'e2e-seed', 0);
INSERT INTO topic (id, slug, name, created_by, created_at) VALUES
  ('e2e-topic-ceremonies', 'e2e-ceremonies', 'E2E Ceremonies', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
