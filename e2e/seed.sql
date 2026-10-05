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
DELETE FROM video_asset WHERE owner_id LIKE 'e2e-educator-%';
DELETE FROM media_asset WHERE uploaded_by LIKE 'e2e-educator-%';
DELETE FROM user WHERE email LIKE 'e2e-educator-%@naisema.test';
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
  ('e2e-educator-desktop', 'E2E Educator', 'e2e-educator-desktop-chromium@naisema.test', 0, 0, 0),
  ('e2e-educator-mobile', 'E2E Educator', 'e2e-educator-mobile-chromium@naisema.test', 0, 0, 0);
INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES
  ('e2e-educator-desktop-role', 'e2e-educator-desktop', 'educator', 'e2e-seed', 0),
  ('e2e-educator-mobile-role', 'e2e-educator-mobile', 'educator', 'e2e-seed', 0);
-- Each Educator's vertical video master, which Stream failed to process (the master itself isn't
-- in local R2, which the journey doesn't need).
INSERT INTO media_asset (id, purpose, type, name, size, status, quarantine_key, destination_key, uploaded_by,
  created_at, updated_at, scanned_at) VALUES
  ('e2e-video-desktop', 'media', 'video/mp4', 'e2e-vale-desktop.mp4', 2048, 'ready', 'uploads/e2e-video-desktop',
    'masters/e2e-video-desktop', 'e2e-educator-desktop', 0, 0, 0),
  ('e2e-video-mobile', 'media', 'video/mp4', 'e2e-vale-mobile.mp4', 2048, 'ready', 'uploads/e2e-video-mobile',
    'masters/e2e-video-mobile', 'e2e-educator-mobile', 0, 0, 0);
INSERT INTO video_asset (id, owner_id, master_key, provider, provider_id, state, state_reason, duration_ms, width,
  height, orientation, environment, created_at, updated_at) VALUES
  ('e2e-video-desktop', 'e2e-educator-desktop', 'masters/e2e-video-desktop', 'stream', 'e2e-stream-desktop', 'failed',
    'Stream couldn''t process it: The file was not recognized as a video.', 61000, 720, 1280, 'portrait',
    'development', 0, 0),
  ('e2e-video-mobile', 'e2e-educator-mobile', 'masters/e2e-video-mobile', 'stream', 'e2e-stream-mobile', 'failed',
    'Stream couldn''t process it: The file was not recognized as a video.', 61000, 720, 1280, 'portrait',
    'development', 0, 0);
-- One editor per browser project for the Submission journey, and the forms earlier runs sent.
DELETE FROM upload_link_file WHERE link_id IN (SELECT id FROM upload_link WHERE issued_by LIKE 'e2e-intake-%');
DELETE FROM media_upload_part WHERE asset_id IN (SELECT id FROM media_asset WHERE uploaded_by LIKE 'e2e-intake-%');
DELETE FROM media_asset WHERE uploaded_by LIKE 'e2e-intake-%';
DELETE FROM upload_link WHERE issued_by LIKE 'e2e-intake-%';
DELETE FROM submission WHERE email LIKE 'e2e-%@example.com';
DELETE FROM consent_record WHERE email LIKE 'e2e-%@example.com';
DELETE FROM user WHERE email LIKE 'e2e-intake-%@naisema.test';
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
  ('e2e-intake-desktop', 'E2E Intake Editor', 'e2e-intake-desktop-chromium@naisema.test', 0, 0, 0),
  ('e2e-intake-mobile', 'E2E Intake Editor', 'e2e-intake-mobile-chromium@naisema.test', 0, 0, 0);
INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES
  ('e2e-intake-desktop-role', 'e2e-intake-desktop', 'editor', 'e2e-seed', 0),
  ('e2e-intake-mobile-role', 'e2e-intake-mobile', 'editor', 'e2e-seed', 0);
-- One safeguarding lead per browser project for the Case journey, and the reports earlier runs sent.
DELETE FROM case_record WHERE details LIKE 'E2E:%';
DELETE FROM user WHERE email LIKE 'e2e-lead-%@naisema.test';
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
  ('e2e-lead-desktop', 'E2E Safeguarding Lead', 'e2e-lead-desktop-chromium@naisema.test', 0, 0, 0),
  ('e2e-lead-mobile', 'E2E Safeguarding Lead', 'e2e-lead-mobile-chromium@naisema.test', 0, 0, 0);
INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES
  ('e2e-lead-desktop-role', 'e2e-lead-desktop', 'safeguarding_lead', 'e2e-seed', 0),
  ('e2e-lead-mobile-role', 'e2e-lead-mobile', 'safeguarding_lead', 'e2e-seed', 0);
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
-- The audio file's own Rights Record: every media library file an item uses needs one (#17).
INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
  evidence_key, evidence_name, evidence_type, created_by, created_at)
VALUES ('e2e-episode-audio-rights', 'media_asset', 'e2e-episode-audio', 'E2E Voices', '["publish"]', 0,
  'rights/e2e', 'permission.pdf', 'application/pdf', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO search_entry (content_item_id, primary_area, format, title, summary, topic_names, published_at)
VALUES ('e2e-episode', 'voices', 'episode', 'Talanoa: coming home to Levuka',
  'Two cousins talk about the first visit home in twenty years.', 'E2E Ceremonies', 1790000000000)
ON CONFLICT(content_item_id) DO NOTHING;
INSERT INTO search_entry_topic (content_item_id, topic_id) VALUES ('e2e-episode', 'e2e-topic-ceremonies')
ON CONFLICT DO NOTHING;

-- A listed Provider with an Offering and a Partnership Agreement, for Connect's pages.
INSERT INTO provider (id, slug, name, description, organisation_type, location, website, contact_route,
  last_checked_on, listed, sponsored_by, feature_rationale, created_by, created_at, updated_at)
VALUES ('e2e-provider', 'e2e-lami-language-school', 'Lami Language School', 'Evening Fijian classes for adults.',
  'school', 'Lami, Fiji', 'https://lami.example', 'Email enrol@lami.example', '2026-09-30', 1, NULL,
  'Small classes, taught online for Fijians abroad.', 'e2e-seed', 0, 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO offering (id, provider_id, title, summary, language_variety, level, age_suitability, accessibility,
  format, cost, cost_kind, starts_on, ends_on, access, access_mode, enrolment_by, support_by, listed,
  created_by, created_at, updated_at)
VALUES ('e2e-offering', 'e2e-provider', 'Conversational Fijian, evenings', 'Ten weeks of talking practice.',
  'Standard Fijian', 'beginner', 'adults', '', 'online', '{"kind":"paid","amount":"120","currency":"AUD"}', 'paid',
  '2026-11-02', '', '{"mode":"external_link","url":"https://lami.example/enrol"}', 'external_link', 'provider',
  'unknown', 1, 'e2e-seed', 0, 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO partnership_agreement (id, provider_id, reference, starts_on, ends_on, recorded_by, recorded_at)
VALUES ('e2e-agreement', 'e2e-provider', 'MOU, founder''s files', '2026-01-01', NULL, 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;

-- A published Creator Profile whose free sample is the seeded article, with a consented portrait.
INSERT INTO media_asset (id, purpose, type, name, size, status, quarantine_key, destination_key, alt_text,
  uploaded_by, created_at, updated_at, scanned_at)
VALUES ('e2e-portrait', 'media', 'image/png', 'litia.png', 1000, 'ready', 'quarantine/e2e-portrait',
  'media/e2e-portrait', 'Litia smiling outside a church in Taveuni', 'e2e-seed', 0, 0, 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
  evidence_key, evidence_name, evidence_type, created_by, created_at)
VALUES ('e2e-portrait-rights', 'media_asset', 'e2e-portrait', 'Litia Vula', '["publish"]', 0,
  'rights/e2e', 'permission.pdf', 'application/pdf', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO content_item (id, type, slug, primary_area, created_by, created_at, updated_at,
  publication_state, first_published_at, last_published_at)
VALUES ('e2e-creator', 'creator', 'e2e-litia-vula', 'connect', 'e2e-seed', 0, 0, 'published',
  1790000000000, 1790000000000)
ON CONFLICT(id) DO NOTHING;
INSERT INTO revision (id, content_item_id, number, snapshot, fingerprints, created_by, created_at)
VALUES ('e2e-creator-r1', 'e2e-creator', 1,
  '{"title":"Litia Vula","summary":"Sings and makes short films about home.","credit":"Profile by the E2E suite","topicIds":["e2e-topic-ceremonies"],"body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Litia grew up in Taveuni and now lives in Brisbane."}]}]},"sources":"","flags":[],"languageVariety":null,"creator":{"location":"Brisbane","languages":["Standard Fijian","English"],"mediaTypes":["music","video"],"portraitAssetId":"e2e-portrait","sampleItemId":"e2e-article"}}',
  '{}', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
UPDATE content_item SET current_draft_revision_id = 'e2e-creator-r1', current_published_revision_id = 'e2e-creator-r1'
WHERE id = 'e2e-creator';
INSERT INTO revision_submission (revision_id, submitted_by, submitted_at) VALUES ('e2e-creator-r1', 'e2e-seed', 0)
ON CONFLICT(revision_id) DO NOTHING;
INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
  evidence_key, evidence_name, evidence_type, created_by, created_at)
VALUES ('e2e-creator-rights', 'content_item', 'e2e-creator', 'Litia Vula', '["publish"]', 0,
  'rights/e2e', 'permission.pdf', 'application/pdf', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO search_entry (content_item_id, primary_area, format, title, summary, topic_names, published_at)
VALUES ('e2e-creator', 'connect', 'creator', 'Litia Vula', 'Sings and makes short films about home.',
  'E2E Ceremonies', 1790000000000)
ON CONFLICT(content_item_id) DO NOTHING;

-- One Educator per browser project for the timeline editor journey, each assigned to a Learning
-- Layer on a Video; earlier runs' Revisions go first. The master isn't in local R2, so the preview
-- shows no picture, which the journey doesn't need.
UPDATE learning_layer SET current_draft_revision_id = NULL, current_published_revision_id = NULL
  WHERE id LIKE 'e2e-layer-%' OR id LIKE 'e2e-review-%';
DELETE FROM learning_layer_approval WHERE revision_id IN
  (SELECT id FROM learning_layer_revision WHERE learning_layer_id LIKE 'e2e-layer-%' OR learning_layer_id LIKE 'e2e-review-%');
DELETE FROM review_link_access WHERE review_link_id IN (SELECT id FROM review_link WHERE revision_id IN
  (SELECT id FROM learning_layer_revision WHERE learning_layer_id LIKE 'e2e-layer-%' OR learning_layer_id LIKE 'e2e-review-%'));
DELETE FROM review_link WHERE revision_id IN
  (SELECT id FROM learning_layer_revision WHERE learning_layer_id LIKE 'e2e-layer-%' OR learning_layer_id LIKE 'e2e-review-%');
DELETE FROM learning_layer_submission WHERE revision_id IN
  (SELECT id FROM learning_layer_revision WHERE learning_layer_id LIKE 'e2e-layer-%' OR learning_layer_id LIKE 'e2e-review-%');
DELETE FROM learning_layer_review_assignment WHERE learning_layer_id LIKE 'e2e-layer-%' OR learning_layer_id LIKE 'e2e-review-%';
DELETE FROM learning_layer_educator WHERE learning_layer_id LIKE 'e2e-layer-%' OR learning_layer_id LIKE 'e2e-review-%';
DELETE FROM learning_layer_revision WHERE learning_layer_id LIKE 'e2e-layer-%' OR learning_layer_id LIKE 'e2e-review-%';
DELETE FROM learning_layer WHERE id LIKE 'e2e-layer-%' OR id LIKE 'e2e-review-%';
DELETE FROM user WHERE email LIKE 'e2e-author-%@naisema.test';
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
  ('e2e-author-desktop', 'E2E Author', 'e2e-author-desktop-chromium@naisema.test', 0, 0, 0),
  ('e2e-author-mobile', 'E2E Author', 'e2e-author-mobile-chromium@naisema.test', 0, 0, 0);
INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES
  ('e2e-author-desktop-role', 'e2e-author-desktop', 'educator', 'e2e-seed', 0),
  ('e2e-author-mobile-role', 'e2e-author-mobile', 'educator', 'e2e-seed', 0);
INSERT INTO media_asset (id, purpose, type, name, size, status, quarantine_key, destination_key, uploaded_by,
  created_at, updated_at, scanned_at)
VALUES ('e2e-ll-video', 'media', 'video/mp4', 'e2e-market.mp4', 2048, 'ready', 'uploads/e2e-ll-video',
  'masters/e2e-ll-video', 'e2e-seed', 0, 0, 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO video_asset (id, owner_id, master_key, provider, provider_id, state, duration_ms, width, height,
  orientation, environment, created_at, updated_at, ready_at)
VALUES ('e2e-ll-video', 'e2e-seed', 'masters/e2e-ll-video', 'local', 'local-e2e-ll-video', 'ready', 30000, 720, 1280,
  'portrait', 'development', 0, 0, 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO content_item (id, type, slug, primary_area, created_by, created_at, updated_at)
VALUES ('e2e-video', 'video', 'e2e-market', 'learn', 'e2e-seed', 0, 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO revision (id, content_item_id, number, snapshot, fingerprints, created_by, created_at)
VALUES ('e2e-video-r1', 'e2e-video', 1,
  '{"title":"At the market","summary":"Two friends meet at the Suva market.","credit":"Filmed by the E2E suite","topicIds":["e2e-topic-ceremonies"],"body":{"type":"doc","content":[]},"sources":"","flags":[],"languageVariety":null,"video":{"videoAssetId":"e2e-ll-video"}}',
  '{}', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
UPDATE content_item SET current_draft_revision_id = 'e2e-video-r1' WHERE id = 'e2e-video';
INSERT INTO learning_layer (id, content_item_id, language_variety, created_by, created_at, updated_at) VALUES
  ('e2e-layer-desktop', 'e2e-video', 'standard-fijian', 'e2e-seed', 0, 0),
  ('e2e-layer-mobile', 'e2e-video', 'standard-fijian', 'e2e-seed', 0, 0);
INSERT INTO learning_layer_revision (id, learning_layer_id, number, snapshot, fingerprints, created_by, created_at) VALUES
  ('e2e-layer-desktop-r1', 'e2e-layer-desktop', 1,
    '{"title":"Greetings desktop","level":"beginner","excerpt":null,"segments":[{"id":"6f1d2c3e-0000-4000-8000-000000000001","startMs":0,"endMs":2000,"speaker":"Mere","fijian":"Bula vinaka.","english":"","overlapIntended":false,"draft":false,"retimed":false}]}',
    '{}', 'e2e-seed', 0),
  ('e2e-layer-mobile-r1', 'e2e-layer-mobile', 1,
    '{"title":"Greetings mobile","level":"beginner","excerpt":null,"segments":[{"id":"6f1d2c3e-0000-4000-8000-000000000002","startMs":0,"endMs":2000,"speaker":"Mere","fijian":"Bula vinaka.","english":"","overlapIntended":false,"draft":false,"retimed":false}]}',
    '{}', 'e2e-seed', 0);
UPDATE learning_layer SET current_draft_revision_id = id || '-r1' WHERE id LIKE 'e2e-layer-%';
INSERT INTO learning_layer_educator (learning_layer_id, user_id, assigned_by, assigned_at) VALUES
  ('e2e-layer-desktop', 'e2e-author-desktop', 'e2e-seed', 0),
  ('e2e-layer-mobile', 'e2e-author-mobile', 'e2e-seed', 0);

-- One editor per browser project for the Review Link journey, and a submitted, culturally sensitive
-- Learning Layer each that someone else wrote, waiting for a Knowledge Holder's approval.
DELETE FROM role_assignment WHERE user_id LIKE 'e2e-kh-editor-%';
DELETE FROM user WHERE email LIKE 'e2e-kh-editor-%@naisema.test';
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
  ('e2e-kh-editor-desktop', 'E2E Review Editor', 'e2e-kh-editor-desktop-chromium@naisema.test', 0, 0, 0),
  ('e2e-kh-editor-mobile', 'E2E Review Editor', 'e2e-kh-editor-mobile-chromium@naisema.test', 0, 0, 0);
INSERT INTO role_assignment (id, user_id, role, granted_by, granted_at) VALUES
  ('e2e-kh-editor-desktop-role', 'e2e-kh-editor-desktop', 'editor', 'e2e-seed', 0),
  ('e2e-kh-editor-mobile-role', 'e2e-kh-editor-mobile', 'editor', 'e2e-seed', 0);
INSERT INTO learning_layer (id, content_item_id, language_variety, created_by, created_at, updated_at) VALUES
  ('e2e-review-desktop', 'e2e-video', 'standard-fijian', 'e2e-seed', 0, 0),
  ('e2e-review-mobile', 'e2e-video', 'standard-fijian', 'e2e-seed', 0, 0);
INSERT INTO learning_layer_revision (id, learning_layer_id, number, snapshot, fingerprints, created_by, created_at) VALUES
  ('e2e-review-desktop-r1', 'e2e-review-desktop', 1,
    '{"title":"Review desktop","level":"beginner","flags":["sensitiveCultural"],"excerpt":null,"segments":[{"id":"6f1d2c3e-0000-4000-8000-000000000011","startMs":0,"endMs":2000,"speaker":"Mere","fijian":"Bula vinaka.","english":"Hello.","overlapIntended":false,"draft":false,"retimed":false}],"activities":[{"id":"7a1d2c3e-0000-4000-8000-000000000011","kind":"listen-repeat","segmentId":"6f1d2c3e-0000-4000-8000-000000000011","prompt":"Listen, then say it aloud.","options":[],"modelResponse":"Bula vinaka.","feedback":"Soften the b, like mb.","pronunciation":"mBOO-la vee-NAH-ka","required":true,"textAlternative":"Read the words and write them out."}]}',
    '{}', 'e2e-seed', 0),
  ('e2e-review-mobile-r1', 'e2e-review-mobile', 1,
    '{"title":"Review mobile","level":"beginner","flags":["sensitiveCultural"],"excerpt":null,"segments":[{"id":"6f1d2c3e-0000-4000-8000-000000000012","startMs":0,"endMs":2000,"speaker":"Mere","fijian":"Bula vinaka.","english":"Hello.","overlapIntended":false,"draft":false,"retimed":false}],"activities":[{"id":"7a1d2c3e-0000-4000-8000-000000000012","kind":"listen-repeat","segmentId":"6f1d2c3e-0000-4000-8000-000000000012","prompt":"Listen, then say it aloud.","options":[],"modelResponse":"Bula vinaka.","feedback":"Soften the b, like mb.","pronunciation":"mBOO-la vee-NAH-ka","required":true,"textAlternative":"Read the words and write them out."}]}',
    '{}', 'e2e-seed', 0);
UPDATE learning_layer SET current_draft_revision_id = id || '-r1' WHERE id LIKE 'e2e-review-%';
INSERT INTO learning_layer_submission (revision_id, submitted_by, submitted_at) VALUES
  ('e2e-review-desktop-r1', 'e2e-seed', 0),
  ('e2e-review-mobile-r1', 'e2e-seed', 0);

-- A published Video with real footage (e2e/fixtures/market.mp4, put into local R2 when the suite
-- starts) and a published Learning Layer on it, for the learner player journey (VAC-02).
INSERT INTO media_asset (id, purpose, type, name, size, status, quarantine_key, destination_key, uploaded_by,
  created_at, updated_at, scanned_at)
VALUES ('e2e-public-video', 'media', 'video/mp4', 'e2e-market-talanoa.mp4', 421464, 'ready', 'uploads/e2e-public-video',
  'masters/e2e-public-video', 'e2e-seed', 0, 0, 0)
ON CONFLICT(id) DO UPDATE SET size = excluded.size;
INSERT INTO video_asset (id, owner_id, master_key, provider, provider_id, state, duration_ms, width, height,
  orientation, environment, created_at, updated_at, ready_at)
VALUES ('e2e-public-video', 'e2e-seed', 'masters/e2e-public-video', 'local', 'local-e2e-public-video', 'ready', 10000,
  360, 640, 'portrait', 'development', 0, 0, 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
  evidence_key, evidence_name, evidence_type, created_by, created_at)
VALUES ('e2e-public-video-file-rights', 'media_asset', 'e2e-public-video', 'E2E Films', '["publish"]', 0,
  'rights/e2e', 'permission.pdf', 'application/pdf', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO content_item (id, type, slug, primary_area, created_by, created_at, updated_at,
  publication_state, first_published_at, last_published_at)
VALUES ('e2e-public-video', 'video', 'e2e-market-talanoa', 'learn', 'e2e-seed', 0, 0, 'published',
  1790000000000, 1790000000000)
ON CONFLICT(id) DO NOTHING;
INSERT INTO revision (id, content_item_id, number, snapshot, fingerprints, created_by, created_at)
VALUES ('e2e-public-video-r1', 'e2e-public-video', 1, '{"title":"Talanoa at the market","summary":"Two friends meet at the Suva market.","credit":"Filmed by the E2E suite","topicIds":["e2e-topic-ceremonies"],"body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Mere and Sera meet by the fruit stalls."}]}]},"sources":"","flags":[],"languageVariety":null,"video":{"videoAssetId":"e2e-public-video"}}', '{}', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
UPDATE content_item SET current_draft_revision_id = 'e2e-public-video-r1',
  current_published_revision_id = 'e2e-public-video-r1' WHERE id = 'e2e-public-video';
INSERT INTO revision_submission (revision_id, submitted_by, submitted_at) VALUES ('e2e-public-video-r1', 'e2e-seed', 0)
ON CONFLICT(revision_id) DO NOTHING;
INSERT INTO rights_record (id, subject_type, subject_id, rights_holder, permitted_uses, guardian_permission,
  evidence_key, evidence_name, evidence_type, created_by, created_at)
VALUES ('e2e-public-video-rights', 'content_item', 'e2e-public-video', 'E2E Films',
  '["publish","translate","transcribe","educationalAdaptation"]', 0,
  'rights/e2e', 'permission.pdf', 'application/pdf', 'e2e-seed', 0)
ON CONFLICT(id) DO NOTHING;
INSERT INTO learning_layer (id, content_item_id, language_variety, publication_state, first_published_at,
  last_published_at, created_by, created_at, updated_at)
VALUES ('e2e-layer-public', 'e2e-public-video', 'standard-fijian', 'published', 1790000000000, 1790000000000,
  'e2e-seed', 0, 0);
-- The library's copy of the Expression the public Learning Layer uses, so learners can save it.
INSERT INTO expression (id, language_variety, headword, headword_key, general_meaning, grammar_note, pronunciation,
  literal_meaning, created_by, created_at, updated_by, updated_at)
VALUES ('9d1d2c3e-0000-4000-8000-000000000001', 'standard-fijian', 'bula vinaka', 'bula vinaka', 'hello; good health',
  '', 'mBOO-la vee-NAH-ka', NULL, 'e2e-seed', 0, 'e2e-seed', 0) ON CONFLICT(id) DO NOTHING;
INSERT INTO learning_layer_revision (id, learning_layer_id, number, snapshot, fingerprints, created_by, created_at)
VALUES ('e2e-layer-public-r1', 'e2e-layer-public', 1, '{"title":"Greetings at the market","level":"beginner","flags":[],"excerpt":null,"segments":[{"id":"6f1d2c3e-0000-4000-8000-000000000021","startMs":0,"endMs":2000,"speaker":"Mere","fijian":"Ni sa bula vinaka.","english":"Hello.","overlapIntended":false,"draft":false,"retimed":false,"tokens":[{"id":"7b1d2c3e-0000-4000-8000-00000001001","text":"Ni"},{"id":"7b1d2c3e-0000-4000-8000-00000001002","text":"sa"},{"id":"7b1d2c3e-0000-4000-8000-00000001003","text":"bula"},{"id":"7b1d2c3e-0000-4000-8000-00000001004","text":"vinaka"}]},{"id":"6f1d2c3e-0000-4000-8000-000000000022","startMs":2000,"endMs":4500,"speaker":"Sera","fijian":"Au lako mai Suva.","english":"I come from Suva.","overlapIntended":false,"draft":false,"retimed":false,"tokens":[{"id":"7b1d2c3e-0000-4000-8000-00000002001","text":"Au"},{"id":"7b1d2c3e-0000-4000-8000-00000002002","text":"lako"},{"id":"7b1d2c3e-0000-4000-8000-00000002003","text":"mai"},{"id":"7b1d2c3e-0000-4000-8000-00000002004","text":"Suva"}]}],"annotations":[{"id":"8c1d2c3e-0000-4000-8000-000000000001","segmentId":"6f1d2c3e-0000-4000-8000-000000000021","startTokenId":"7b1d2c3e-0000-4000-8000-00000001003","endTokenId":"7b1d2c3e-0000-4000-8000-00000001004","expressionId":"9d1d2c3e-0000-4000-8000-000000000001","contextualMeaning":"Hello, to a friend","grammarNote":"","inVocabulary":true,"needsCheck":false}],"notes":[{"id":"ac1d2c3e-0000-4000-8000-000000000001","segmentId":null,"kind":"cultural","text":"The market is where families catch up on news.","attribution":"Mere, a stallholder in Suva"}],"expressions":{"9d1d2c3e-0000-4000-8000-000000000001":{"headword":"bula vinaka","generalMeaning":"hello; good health","grammarNote":"","pronunciation":"mBOO-la vee-NAH-ka","literalMeaning":null}},"activities":[{"id":"aa1d2c3e-0000-4000-8000-000000000002","kind":"listen-repeat","segmentId":"6f1d2c3e-0000-4000-8000-000000000021","prompt":"Listen to Mere, then say her greeting aloud.","options":[],"modelResponse":"Ni sa bula vinaka.","feedback":"Soften the b, like mb.","pronunciation":"nee sah mBOO-la vee-NAH-ka","required":true,"textAlternative":"Read the first line of the transcript and write it out."},{"id":"aa1d2c3e-0000-4000-8000-000000000003","kind":"real-world","segmentId":null,"prompt":"Greet someone you know in Fijian this week.","options":[],"modelResponse":"Bula vinaka!","feedback":"However it went, that is a start.","pronunciation":"","required":false,"textAlternative":"Write how you might greet someone."},{"id":"aa1d2c3e-0000-4000-8000-000000000001","kind":"comprehension","segmentId":null,"prompt":"Where does Sera come from?","options":[{"id":"ab1d2c3e-0000-4000-8000-000000000001","text":"Suva","correct":true},{"id":"ab1d2c3e-0000-4000-8000-000000000002","text":"Levuka","correct":false}],"modelResponse":"","feedback":"She says she comes from Suva.","pronunciation":"","required":true,"textAlternative":"Read the transcript, then choose where Sera comes from."},{"id":"aa1d2c3e-0000-4000-8000-000000000005","kind":"discrimination","segmentId":"6f1d2c3e-0000-4000-8000-000000000022","prompt":"Which place does Sera name?","options":[{"id":"ab1d2c3e-0000-4000-8000-000000000005","text":"Suva","correct":true},{"id":"ab1d2c3e-0000-4000-8000-000000000006","text":"Savusavu","correct":false}],"modelResponse":"","feedback":"She names Suva, the capital.","pronunciation":"","required":false,"textAlternative":"Read the second line of the transcript, then choose the place."},{"id":"aa1d2c3e-0000-4000-8000-000000000006","kind":"next-line","segmentId":null,"prompt":"Mere greets you. What would you say back?","options":[],"modelResponse":"Io, bula vinaka.","feedback":"Answer a greeting with the same words.","pronunciation":"","required":false,"textAlternative":"Write what you would say back to Mere."}]}', '{}', 'e2e-seed', 0);
UPDATE learning_layer SET current_draft_revision_id = 'e2e-layer-public-r1',
  current_published_revision_id = 'e2e-layer-public-r1' WHERE id = 'e2e-layer-public';
INSERT INTO learning_layer_submission (revision_id, submitted_by, submitted_at) VALUES ('e2e-layer-public-r1', 'e2e-seed', 0);
INSERT INTO learning_layer_approval (id, revision_id, review_type, language_variety, decision, reviewer_id, decided_at)
VALUES ('e2e-layer-public-language', 'e2e-layer-public-r1', 'language', 'standard-fijian', 'approved', 'e2e-seed', 0);
