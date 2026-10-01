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
-- One Educator per browser project for the media library journey; their earlier uploads go first.
DELETE FROM media_upload_part WHERE asset_id IN (SELECT id FROM media_asset WHERE uploaded_by LIKE 'e2e-educator-%');
DELETE FROM media_asset WHERE uploaded_by LIKE 'e2e-educator-%';
DELETE FROM user WHERE email LIKE 'e2e-educator-%@naisema.test';
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
  ('e2e-educator-desktop', 'E2E Educator', 'e2e-educator-desktop-chromium@naisema.test', 0, 0, 0),
  ('e2e-educator-mobile', 'E2E Educator', 'e2e-educator-mobile-chromium@naisema.test', 0, 0, 0);
INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES
  ('e2e-educator-desktop-role', 'e2e-educator-desktop', 'educator', 'e2e-seed', 0),
  ('e2e-educator-mobile-role', 'e2e-educator-mobile', 'educator', 'e2e-seed', 0);
INSERT INTO topic (id, slug, name, created_by, created_at) VALUES
  ('e2e-topic-ceremonies', 'e2e-ceremonies', 'E2E Ceremonies', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;

-- One published, eligible article for the public pages: submitted, no flags (so no reviews
-- needed) and a current Rights Record granting Publish.
INSERT INTO content_item (id, type, slug, primary_area, created_by, created_at, updated_at,
  publication_state, first_published_at, last_published_at)
VALUES ('e2e-article', 'article', 'e2e-letter-from-home', 'ezine', 'e2e-seed', 0, 0, 'published',
  1790000000000, 1790000000000)
ON CONFLICT(id) DO NOTHING;
INSERT INTO revision (id, content_item_id, number, snapshot, fingerprints, created_by, created_at)
VALUES ('e2e-article-r1', 'e2e-article', 1,
  '{"title":"A letter from home","summary":"How the village greets a visitor who has been away a long time.","credit":"Words by the E2E suite","topicIds":["e2e-topic-ceremonies"],"body":{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Arriving"}]},{"type":"paragraph","content":[{"type":"text","text":"You are met at the road and walked to the house."}]},{"type":"paragraph","content":[{"type":"text","text":"Someone older speaks for you, and the family answers. Nobody hurries."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Staying"}]},{"type":"paragraph","content":[{"type":"text","text":"You eat when you are told to, and you sleep where you are put."}]},{"type":"callout","content":[{"type":"paragraph","content":[{"type":"text","text":"Bring something to share."}]}]}]},"sources":"","flags":["opinion"],"languageVariety":null}',
  '{}', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
UPDATE content_item SET current_draft_revision_id = 'e2e-article-r1', current_published_revision_id = 'e2e-article-r1'
WHERE id = 'e2e-article';
INSERT INTO revision_submission (revision_id, submitted_by, submitted_at) VALUES ('e2e-article-r1', 'e2e-seed', 0)
ON CONFLICT(revision_id) DO NOTHING;
INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
  evidence_key, evidence_name, evidence_type, created_by, created_at)
VALUES ('e2e-article-rights', 'content_item', 'e2e-article', 'E2E Storyteller', '["publish"]', 0,
  'rights/e2e', 'permission.pdf', 'application/pdf', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
-- Its search entry, as publishing would write it (app/lib/search.server.ts).
INSERT INTO search_entry (content_item_id, primary_area, format, title, summary, topic_names, published_at)
VALUES ('e2e-article', 'ezine', 'article', 'A letter from home',
  'How the village greets a visitor who has been away a long time.', 'E2E Ceremonies', 1790000000000)
ON CONFLICT(content_item_id) DO NOTHING;
INSERT INTO search_entry_topic (content_item_id, topic_id) VALUES ('e2e-article', 'e2e-topic-ceremonies')
ON CONFLICT DO NOTHING;

-- A published link Resource, and a description for the seeded Topic, for the public pages' checks.
UPDATE topic SET description = 'Sevusevu, the yaqona ceremony and how a visit begins.' WHERE id = 'e2e-topic-ceremonies';
INSERT INTO content_item (id, type, slug, primary_area, created_by, created_at, updated_at,
  publication_state, first_published_at, last_published_at)
VALUES ('e2e-resource', 'resource', 'e2e-dictionary-link', 'resources', 'e2e-seed', 0, 0, 'published',
  1790000000000, 1790000000000)
ON CONFLICT(id) DO NOTHING;
INSERT INTO revision (id, content_item_id, number, snapshot, fingerprints, created_by, created_at)
VALUES ('e2e-resource-r1', 'e2e-resource', 1,
  '{"title":"A Fijian dictionary online","summary":"Look words up in Standard Fijian and English.","credit":"Listed by the E2E suite","topicIds":["e2e-topic-ceremonies"],"body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"A free dictionary kept by another site."}]}]},"sources":"","flags":[],"languageVariety":null,"resource":{"source":{"kind":"link","url":"https://example.org/dictionary","checkedOn":"2026-09-30"},"language":"Standard Fijian and English","ageGuidance":"all-ages","accessibility":"Works with screen readers.","usageTerms":"Free to use; follow the site''s own terms."}}',
  '{}', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
UPDATE content_item SET current_draft_revision_id = 'e2e-resource-r1', current_published_revision_id = 'e2e-resource-r1'
WHERE id = 'e2e-resource';
INSERT INTO revision_submission (revision_id, submitted_by, submitted_at) VALUES ('e2e-resource-r1', 'e2e-seed', 0)
ON CONFLICT(revision_id) DO NOTHING;
INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
  evidence_key, evidence_name, evidence_type, created_by, created_at)
VALUES ('e2e-resource-rights', 'content_item', 'e2e-resource', 'E2E Listing', '["publish"]', 0,
  'rights/e2e', 'permission.pdf', 'application/pdf', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO search_entry (content_item_id, primary_area, format, title, summary, topic_names, published_at)
VALUES ('e2e-resource', 'resources', 'resource', 'A Fijian dictionary online',
  'Look words up in Standard Fijian and English.', 'E2E Ceremonies', 1790000000000)
ON CONFLICT(content_item_id) DO NOTHING;
INSERT INTO search_entry_topic (content_item_id, topic_id) VALUES ('e2e-resource', 'e2e-topic-ceremonies')
ON CONFLICT DO NOTHING;

-- A published Voices Episode with its transcript reviewed for accessibility. Its audio row is in
-- the media library; the file itself isn't in local R2, which the page doesn't need.
INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
VALUES ('e2e-seed', 'E2E Seed', 'e2e-seed@naisema.test', 0, 0, 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO media_asset (id, purpose, type, name, size, status, quarantine_key, destination_key, uploaded_by,
  created_at, updated_at, scanned_at)
VALUES ('e2e-episode-audio', 'media', 'audio/mpeg', 'talanoa.mp3', 1000, 'ready', 'quarantine/e2e-episode-audio',
  'media/e2e-episode-audio', 'e2e-seed', 0, 0, 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO content_item (id, type, slug, primary_area, created_by, created_at, updated_at,
  publication_state, first_published_at, last_published_at)
VALUES ('e2e-episode', 'episode', 'e2e-talanoa', 'voices', 'e2e-seed', 0, 0, 'published',
  1790000000000, 1790000000000)
ON CONFLICT(id) DO NOTHING;
INSERT INTO revision (id, content_item_id, number, snapshot, fingerprints, created_by, created_at)
VALUES ('e2e-episode-r1', 'e2e-episode', 1,
  '{"title":"Talanoa: coming home to Levuka","summary":"Two cousins talk about the first visit home in twenty years.","credit":"Produced by the E2E suite","topicIds":["e2e-topic-ceremonies"],"body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Recorded in Auckland."}]}]},"sources":"","flags":[],"languageVariety":null,"episode":{"audioAssetId":"e2e-episode-audio","host":"Mere Vula","guests":["Ratu Joni"],"recordedOn":"2026-09-12","durationSeconds":1930,"transcript":"Mere: Bula vinaka, Ratu.\n\nRatu Joni: Bula, Mere. It has been a long time.\n\n[Laughter]","distribution":[{"label":"Spotify","url":"https://open.spotify.com/episode/e2e"}]}}',
  '{}', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
UPDATE content_item SET current_draft_revision_id = 'e2e-episode-r1', current_published_revision_id = 'e2e-episode-r1'
WHERE id = 'e2e-episode';
INSERT INTO revision_submission (revision_id, submitted_by, submitted_at) VALUES ('e2e-episode-r1', 'e2e-seed', 0)
ON CONFLICT(revision_id) DO NOTHING;
INSERT INTO review_approval (id, revision_id, review_type, decision, reviewer_id, decided_at)
VALUES ('e2e-episode-accessibility', 'e2e-episode-r1', 'accessibility', 'approved', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
  evidence_key, evidence_name, evidence_type, created_by, created_at)
VALUES ('e2e-episode-rights', 'content_item', 'e2e-episode', 'E2E Voices', '["publish"]', 0,
  'rights/e2e', 'permission.pdf', 'application/pdf', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO search_entry (content_item_id, primary_area, format, title, summary, topic_names, published_at)
VALUES ('e2e-episode', 'voices', 'episode', 'Talanoa: coming home to Levuka',
  'Two cousins talk about the first visit home in twenty years.', 'E2E Ceremonies', 1790000000000)
ON CONFLICT(content_item_id) DO NOTHING;
INSERT INTO search_entry_topic (content_item_id, topic_id) VALUES ('e2e-episode', 'e2e-topic-ceremonies')
ON CONFLICT DO NOTHING;
