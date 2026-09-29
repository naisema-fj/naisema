-- Fixture data for browser tests. Never used outside local and CI test runs.
INSERT INTO site_settings (key, value, updated_at)
VALUES ('welcome_statement', 'Welcome to the NAISEMA test build.', 0)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
