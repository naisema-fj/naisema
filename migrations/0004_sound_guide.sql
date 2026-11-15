-- The sound guide (change note 0003): one Sound for each letter of Standard Fijian, with its own
-- language review. The 24 entries are the pronunciation library's own data from apps.naisema.com,
-- imported as it stood on 15 November 2026, wording unchanged (the IPA is kept without its slashes,
-- which the page adds, and "Dz" has none). None starts out reviewed: no
-- Language Reviewer has approved any of them. Each plays the preview's own recording until staff
-- attach one from the media library, which needs a Rights Record naming the speaker.
CREATE TABLE `sound` (
	`id` text PRIMARY KEY NOT NULL,
	`variety` text NOT NULL,
	`letter` text NOT NULL,
	`display` text NOT NULL,
	`sound_group` text NOT NULL,
	`ipa` text DEFAULT '' NOT NULL,
	`english_comparison` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`media_id` text,
	`preview_audio` text,
	`duration_ms` integer,
	`origin` text DEFAULT '' NOT NULL,
	`position` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sound_group" CHECK("sound"."sound_group" in ('vowel', 'consonant', 'label'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sound_letter` ON `sound` (`variety`,`letter`);
--> statement-breakpoint
CREATE TABLE `sound_approval` (
	`id` text PRIMARY KEY NOT NULL,
	`sound_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`variety` text NOT NULL,
	`reviewer_email` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sound_id`) REFERENCES `sound`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sound_approval_sound` ON `sound_approval` (`sound_id`);
--> statement-breakpoint
CREATE TRIGGER `sound_approval_no_update` BEFORE UPDATE ON `sound_approval`
BEGIN
	SELECT RAISE(ABORT, 'Approvals are only added');
END;
--> statement-breakpoint
CREATE TRIGGER `sound_approval_no_delete` BEFORE DELETE ON `sound_approval`
BEGIN
	SELECT RAISE(ABORT, 'Approvals are only added');
END;
--> statement-breakpoint
INSERT INTO `sound` (`id`, `variety`, `letter`, `display`, `sound_group`, `ipa`, `english_comparison`, `note`, `preview_audio`, `duration_ms`, `origin`, `position`, `updated_by`, `updated_at`) VALUES
('standard-fijian-a', 'standard-fijian', 'A', 'A a', 'vowel', 'a', 'a in father', 'An open vowel. Keep the jaw open and the tongue low.', 'audio/A.mp3', 4490, 'Recording supplied with the preview', 0, 'import', (unixepoch() * 1000)),
('standard-fijian-b', 'standard-fijian', 'B', 'B b', 'consonant', 'ᵐb', 'mb in amber', 'A short nasal m sound flows into b as the lips open.', 'audio/B.mp3', 4250, 'Recording supplied with the preview', 1, 'import', (unixepoch() * 1000)),
('standard-fijian-c', 'standard-fijian', 'C', 'C c', 'consonant', 'ð', 'th in this', 'A voiced th sound, not the th of thin.', 'audio/C.mp3', 4580, 'Recording supplied with the preview', 2, 'import', (unixepoch() * 1000)),
('standard-fijian-d', 'standard-fijian', 'D', 'D d', 'consonant', 'ⁿd', 'nd in Sunday', 'A short n-like nasal beginning followed by d.', 'audio/D.mp3', 4420, 'Recording supplied with the preview', 3, 'import', (unixepoch() * 1000)),
('standard-fijian-e', 'standard-fijian', 'E', 'E e', 'vowel', 'e', 'start of bait, without the glide', 'A front vowel; English comparisons vary by accent. Do not add the English ay glide.', 'audio/E.mp3', 4490, 'Recording supplied with the preview', 4, 'import', (unixepoch() * 1000)),
('standard-fijian-f', 'standard-fijian', 'F', 'F f', 'consonant', 'f', 'f in fish', 'The upper teeth come near the lower lip; air flows out.', 'audio/F.mp3', 4750, 'Recording supplied with the preview', 5, 'import', (unixepoch() * 1000)),
('standard-fijian-g', 'standard-fijian', 'G', 'G g', 'consonant', 'ŋ', 'ng in singer', 'A single nasal sound, without a hard g after it.', 'audio/G.mp3', 4060, 'Recording supplied with the preview', 6, 'import', (unixepoch() * 1000)),
('standard-fijian-i', 'standard-fijian', 'I', 'I i', 'vowel', 'i', 'ee in see', 'A high front vowel, with gently spread lips.', 'audio/I.mp3', 4250, 'Recording supplied with the preview', 7, 'import', (unixepoch() * 1000)),
('standard-fijian-j', 'standard-fijian', 'J', 'J j', 'consonant', 'tʃ', 'ch in church', 'A ch-like sound in many Fijian varieties; other realizations exist.', 'audio/J.mp3', 4820, 'Recording supplied with the preview', 8, 'import', (unixepoch() * 1000)),
('standard-fijian-k', 'standard-fijian', 'K', 'K k', 'consonant', 'k', 'k in kite', 'A brief closure at the back of the tongue followed by release.', 'audio/K.mp3', 4520, 'User-supplied recording', 9, 'import', (unixepoch() * 1000)),
('standard-fijian-l', 'standard-fijian', 'L', 'L l', 'consonant', 'l', 'l in lamp', 'Tongue tip touches near the upper front gum ridge.', 'audio/L.mp3', 3980, 'Recording supplied with the preview', 10, 'import', (unixepoch() * 1000)),
('standard-fijian-m', 'standard-fijian', 'M', 'M m', 'consonant', 'm', 'm in mother', 'Close both lips and let sound resonate through the nose.', 'audio/M.mp3', 4490, 'Recording supplied with the preview', 11, 'import', (unixepoch() * 1000)),
('standard-fijian-n', 'standard-fijian', 'N', 'N n', 'consonant', 'n', 'n in no', 'Tongue tip touches near the upper gum ridge while the sound resonates through the nose.', 'audio/N.mp3', 5210, 'User-supplied recording', 12, 'import', (unixepoch() * 1000)),
('standard-fijian-o', 'standard-fijian', 'O', 'O o', 'vowel', 'o', 'start of boat, without the glide', 'A mid-back rounded vowel. Keep the lips rounded without adding an English ow glide.', 'audio/O.mp3', 4180, 'User-supplied recording', 13, 'import', (unixepoch() * 1000)),
('standard-fijian-p', 'standard-fijian', 'P', 'P p', 'consonant', 'p', 'p in spin', 'Two lips meet and release without the strong puff common in English pin.', 'audio/P.mp3', 4320, 'Recording supplied with the preview', 14, 'import', (unixepoch() * 1000)),
('standard-fijian-q', 'standard-fijian', 'Q', 'Q q', 'consonant', 'ᵑɡ', 'ng-g in finger', 'Start with ng and release into a voiced g. Different from G.', 'audio/Q.mp3', 4060, 'Recording supplied with the preview', 15, 'import', (unixepoch() * 1000)),
('standard-fijian-r', 'standard-fijian', 'R', 'R r', 'consonant', 'r', 'rolled/tapped r; not English r', 'Tongue tip taps or trills at the ridge behind the upper teeth.', 'audio/R.mp3', 5180, 'Recording supplied with the preview', 16, 'import', (unixepoch() * 1000)),
('standard-fijian-s', 'standard-fijian', 'S', 'S s', 'consonant', 's', 's in sun', 'A voiceless s sound, similar to s in sun.', 'audio/S.mp3', 3930, 'User-supplied recording', 17, 'import', (unixepoch() * 1000)),
('standard-fijian-t', 'standard-fijian', 'T', 'T t', 'consonant', 't', 't in stop', 'Tongue tip makes a brief closure behind the upper teeth.', 'audio/T.mp3', 3890, 'Recording supplied with the preview', 18, 'import', (unixepoch() * 1000)),
('standard-fijian-u', 'standard-fijian', 'U', 'U u', 'vowel', 'u', 'oo in food', 'A high back vowel with rounded lips.', 'audio/U.mp3', 3820, 'Recording supplied with the preview', 19, 'import', (unixepoch() * 1000)),
('standard-fijian-v', 'standard-fijian', 'V', 'V v', 'consonant', 'β', 'between b and v; bilabial', 'In Standard Fijian this is often a bilabial fricative, made with both lips rather than the English upper-teeth-on-lip v.', 'audio/V.mp3', 4180, 'User-supplied recording', 20, 'import', (unixepoch() * 1000)),
('standard-fijian-w', 'standard-fijian', 'W', 'W w', 'consonant', 'w', 'roughly w in water', 'A glide with pronunciation variation; some speakers use less lip rounding.', 'audio/W.mp3', 3890, 'Recording supplied with the preview', 21, 'import', (unixepoch() * 1000)),
('standard-fijian-y', 'standard-fijian', 'Y', 'Y y', 'consonant', 'j', 'y in yes', 'A palatal glide, not the English letter name why.', 'audio/Y.mp3', 4060, 'Recording supplied with the preview', 22, 'import', (unixepoch() * 1000)),
('standard-fijian-dz', 'standard-fijian', 'Dz', 'Dz', 'label', '', 'No reliable English match confirmed', 'This recording is labelled Dz. Its IPA and orthographic status need Fijian-language review.', 'audio/Dz.mp3', 4820, 'Recording supplied with the preview', 23, 'import', (unixepoch() * 1000));
