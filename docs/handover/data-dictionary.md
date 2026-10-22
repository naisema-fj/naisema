# Data dictionary

Every table and column in the NAISEMA database. This file is generated from `db/schema.ts` by `pnpm docs:data-dictionary`; do not edit it by hand. CI fails if it is out of date. To change a description, change the comment above the table or column in the schema.

Types are SQLite's. Dates are stored as integer milliseconds since 1970 (UTC). Columns marked "JSON" hold JSON text. The full-text search table `search_fts` is created by a migration (`migrations/0006_search.sql`) rather than the schema, so it is not listed here.

63 tables.

## Tables

- [`account`](#account)
- [`activity_attempt`](#activity_attempt)
- [`audit_event`](#audit_event)
- [`bookmark`](#bookmark)
- [`case_evidence`](#case_evidence)
- [`case_record`](#case_record)
- [`consent_record`](#consent_record)
- [`content_hold`](#content_hold)
- [`content_item`](#content_item)
- [`contributor`](#contributor)
- [`email_failure`](#email_failure)
- [`email_outbox`](#email_outbox)
- [`expression`](#expression)
- [`job_run`](#job_run)
- [`learner_account`](#learner_account)
- [`learner_event`](#learner_event)
- [`learner_rate_limit`](#learner_rate_limit)
- [`learner_sign_in_link`](#learner_sign_in_link)
- [`learner_video_state`](#learner_video_state)
- [`learning_layer`](#learning_layer)
- [`learning_layer_approval`](#learning_layer_approval)
- [`learning_layer_educator`](#learning_layer_educator)
- [`learning_layer_review_assignment`](#learning_layer_review_assignment)
- [`learning_layer_revision`](#learning_layer_revision)
- [`learning_layer_submission`](#learning_layer_submission)
- [`link_report`](#link_report)
- [`media_asset`](#media_asset)
- [`media_upload_part`](#media_upload_part)
- [`monitor_alert`](#monitor_alert)
- [`newsletter_outbox`](#newsletter_outbox)
- [`notice`](#notice)
- [`offering`](#offering)
- [`partnership_agreement`](#partnership_agreement)
- [`provider`](#provider)
- [`rate_limit`](#rate_limit)
- [`review_approval`](#review_approval)
- [`review_assignment`](#review_assignment)
- [`review_link`](#review_link)
- [`review_link_access`](#review_link_access)
- [`revision`](#revision)
- [`revision_submission`](#revision_submission)
- [`rights_expiry_warning`](#rights_expiry_warning)
- [`rights_record`](#rights_record)
- [`rights_record_contributor`](#rights_record_contributor)
- [`role_assignment`](#role_assignment)
- [`saved_vocabulary`](#saved_vocabulary)
- [`search_entry`](#search_entry)
- [`search_entry_topic`](#search_entry_topic)
- [`server_error`](#server_error)
- [`session`](#session)
- [`site_settings`](#site_settings)
- [`slug_redirect`](#slug_redirect)
- [`staff_session`](#staff_session)
- [`submission`](#submission)
- [`topic`](#topic)
- [`two_factor`](#two_factor)
- [`upload_link`](#upload_link)
- [`upload_link_file`](#upload_link_file)
- [`usage_month`](#usage_month)
- [`user`](#user)
- [`verification`](#verification)
- [`video_asset`](#video_asset)
- [`video_educator`](#video_educator)

## account

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `account_id` | text | no |  |  |  |
| `provider_id` | text | no |  |  |  |
| `user_id` | text | no |  | `user.id` |  |
| `access_token` | text | yes |  |  |  |
| `refresh_token` | text | yes |  |  |  |
| `id_token` | text | yes |  |  |  |
| `access_token_expires_at` | integer | yes |  |  |  |
| `refresh_token_expires_at` | integer | yes |  |  |  |
| `scope` | text | yes |  |  |  |
| `password` | text | yes |  |  |  |
| `created_at` | integer | no | set by the database |  |  |
| `updated_at` | integer | no | set by the database |  |  |

## activity_attempt

An Activity answered, by either route, with its feedback seen. The ID is the client's, so a retried send is one attempt. The Activity's fingerprint decides whether it still counts once another Revision is published (ADR-0006).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `user_id` | text | no |  | `user.id` |  |
| `id` | text | no |  |  |  |
| `learning_layer_id` | text | no |  | `learning_layer.id` |  |
| `revision_id` | text | no |  | `learning_layer_revision.id` |  |
| `activity_id` | text | no |  |  |  |
| `activity_fingerprint` | text | no |  |  |  |
| `correct` | integer | yes |  |  | Whether the answer was right, or null where nothing is checked. |
| `attempted_at` | integer | no |  |  |  |

## audit_event

Append-only record of elevated and security-relevant actions (CMS-05).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `actor_id` | text | yes |  |  |  |
| `action` | text | no |  |  |  |
| `object_type` | text | no |  |  |  |
| `object_id` | text | yes |  |  |  |
| `details` | text (JSON) | yes |  |  |  |
| `created_at` | integer | no |  |  |  |

## bookmark

A Content Item a learner saved, such as a video story.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `user_id` | text | no |  | `user.id` |  |
| `content_item_id` | text | no |  | `content_item.id` |  |
| `saved_at` | integer | no |  |  |  |

## case_evidence

Restricted evidence a case team adds to a Case: scanned like any upload, kept in EVIDENCE.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `asset_id` | text (primary key) | no |  | `media_asset.id` |  |
| `case_id` | text | no |  | `case_record.id` |  |
| `added_by` | text | no |  |  |  |
| `added_at` | integer | no |  |  |  |

## case_record

A restricted, audited record of a report, rights concern or data request (CONTEXT.md, Case). Only the role that handles its kind can read it (permissions.ts), and every view and change is audited. A decision can be appealed once, and someone else decides the appeal.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `kind` | text | no |  |  |  |
| `form_key` | text (unique) | yes |  |  | The key its form was rendered with: sending the same form twice opens one Case. |
| `state` | text | no | `"received"` |  |  |
| `reason` | text | no |  |  | What the person said was wrong, or asked for (case-rules.ts). |
| `details` | text | no |  |  |  |
| `content_item_id` | text | yes |  | `content_item.id` | The content it is about, from the report link on the item's page. |
| `affected_person` | text | no | `""` |  | Who it is about, in the case team's words: a creator, a person in a recording, the requester. |
| `reporter_name` | text | no | `""` |  |  |
| `reporter_email` | text | yes |  |  | Null for an anonymous report. |
| `severity` | text | yes |  |  |  |
| `owner_id` | text | yes |  |  |  |
| `outcome` | text | yes |  |  |  |
| `action` | text | yes |  |  |  |
| `rationale` | text | yes |  |  |  |
| `decided_by` | text | yes |  |  |  |
| `decided_at` | integer | yes |  |  |  |
| `appeal_reasons` | text | yes |  |  |  |
| `appealed_at` | integer | yes |  |  |  |
| `appeal_outcome` | text | yes |  |  |  |
| `appeal_rationale` | text | yes |  |  |  |
| `appeal_decided_by` | text | yes |  |  |  |
| `appeal_decided_at` | integer | yes |  |  |  |
| `received_at` | integer | no |  |  |  |
| `updated_at` | integer | no |  |  |  |
| `closed_at` | integer | yes |  |  |  |

## consent_record

That a person agreed to one purpose under one notice version (CONTEXT.md, Consent Record): when, on which form, and when they withdrew. Kept apart from the Submission it came with, which it outlives: deleting a Submission leaves the record of what was agreed.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `purpose` | text | no |  |  |  |
| `notice_id` | text | no |  | `notice.id` |  |
| `email` | text | no |  |  |  |
| `source_form` | text | no |  |  | The form it was given on: a Submission type, or "newsletter". |
| `submission_id` | text | yes |  |  | The Submission it came with, if any; not a foreign key, so the Submission can be deleted. |
| `given_at` | integer | no |  |  |  |
| `withdrawn_at` | integer | yes |  |  |  |
| `withdrawn_via` | text | yes |  |  | How it was withdrawn: the person's own link, an unsubscribe, or staff on their request. |

## content_hold

A Content Item hidden from the public while a Case about it is reviewed (SAFE-03). While a hold is in place the item is not eligible (ADR-0007), whatever its reviews and rights; lifting the hold brings it back. Holds are lifted, never deleted.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `content_item_id` | text | no |  | `content_item.id` |  |
| `case_id` | text | no |  | `case_record.id` |  |
| `placed_by` | text | no |  |  |  |
| `placed_at` | integer | no |  |  |  |
| `lifted_by` | text | yes |  |  |  |
| `lifted_at` | integer | yes |  |  |  |

## content_item

The stable parent of a Content Item: its identity and URL, pointing at its current draft and current published Revision. Everything an editor writes lives in the Revisions.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `type` | text | no |  |  |  |
| `slug` | text | no |  |  |  |
| `primary_area` | text | no |  |  |  |
| `current_draft_revision_id` | text | yes |  | `revision.id` |  |
| `current_published_revision_id` | text | yes |  | `revision.id` |  |
| `publication_state` | text | no | `"unpublished"` |  | unpublished → published → withdrawn → archived (docs/phase-1a-defaults.md §3). |
| `first_published_at` | integer | yes |  |  | When the item first went public, and when its current published Revision was published. |
| `last_published_at` | integer | yes |  |  |  |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |
| `updated_at` | integer | no |  |  |  |

## contributor

Anyone whose story, recording or knowledge appears in content: a rights and credit relationship.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `name` | text | no |  |  |  |
| `notes` | text | yes |  |  |  |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |

## email_failure

An email that couldn't be sent (app/lib/email.server.ts), for the hourly monitor. Only its subject and when: never the address or the text.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | integer (primary key) | no | set by the database |  |  |
| `subject` | text | no |  |  |  |
| `failed_at` | integer | no |  |  |  |

## email_outbox

Local development and test builds only: outgoing email is written here instead of being sent (EMAIL_OUTBOX = "true"). Deployed environments send through Cloudflare Email Service.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | integer (primary key) | no | set by the database |  |  |
| `to` | text | no |  |  |  |
| `subject` | text | no |  |  |  |
| `text` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |

## expression

An Expression (ADR-0011, VID-07): a word or multiword phrase with its general meaning, grammar note and pronunciation guidance, reused by Annotations across Learning Layers. An idiom also has its literal meaning. Each Learning Layer Revision keeps a copy of the Expressions it uses, so a later change here shows in a Learning Layer only when it is next saved, and is reviewed then.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `language_variety` | text | no |  |  |  |
| `headword` | text | no |  |  |  |
| `headword_key` | text | no |  |  | The headword as matched: Unicode lower case, so "Ā" and "ā" are the same word. |
| `general_meaning` | text | no |  |  |  |
| `grammar_note` | text | no | `""` |  |  |
| `pronunciation` | text | no | `""` |  |  |
| `literal_meaning` | text | yes |  |  |  |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |
| `updated_by` | text | no |  |  |  |
| `updated_at` | integer | no |  |  |  |

## job_run

One run of a scheduled job (workers/app.ts), so the monitor sees runs that failed and jobs that stopped running. `ok` stays empty while it runs, and for good if the Worker died part-way.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `job` | text | no |  |  |  |
| `started_at` | integer | no |  |  |  |
| `finished_at` | integer | yes |  |  |  |
| `ok` | integer | yes |  |  |  |
| `error` | text | yes |  |  | Why it failed, redacted (app/lib/log.server.ts). |

## learner_account

A Learner Account: a user who signed up on the public site, declaring they are 18 or older. It holds nothing about who they are beyond their email address (MEM-01/02, DATA-01).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `user_id` | text (primary key) | no |  | `user.id` |  |
| `adult_declared_at` | integer | no |  |  | When they declared they are 18 or older, which they do before any sign-in link is sent. |
| `last_active_at` | integer | no |  |  |  |
| `inactivity_warned_at` | integer | yes |  |  | When they were warned that the inactive account will be deleted; cleared by any activity. |
| `preferences` | text | yes |  |  | Support preferences, the same on every Learning Layer (app/lib/learner-session.ts), as JSON. |

## learner_event

A progress event already applied, by its client ID, so a retried send changes nothing (§8).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `user_id` | text | no |  | `user.id` |  |
| `event_id` | text | no |  |  |  |
| `received_at` | integer | no |  |  |  |

## learner_rate_limit

Better Auth's request counts for Learner Accounts, kept apart from staff sign-in's (`rate_limit`), since both count by address and path: learners signing in can never use up staff members' limit.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `key` | text (unique) | no |  |  |  |
| `count` | integer | no |  |  |  |
| `last_request` | integer | no |  |  |  |

## learner_sign_in_link

Sign-in links sent to a learner's address, by its hash, so nobody can flood an inbox.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | integer (primary key) | no | set by the database |  |  |
| `email_hash` | text | no |  |  |  |
| `sent_at` | integer | no |  |  |  |

## learner_video_state

Where a learner is in one Learning Layer: the Revision they were last on, the stage and position last received (the latest received wins, §8), the stages visited, their caption and real-world choices, and when they completed it and on which Revision.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `user_id` | text | no |  | `user.id` |  |
| `learning_layer_id` | text | no |  | `learning_layer.id` |  |
| `revision_id` | text | no |  | `learning_layer_revision.id` |  |
| `stage` | text | no |  |  |  |
| `position_ms` | integer | no | `0` |  |  |
| `segment_id` | text | yes |  |  | The Segment playing at that position; the position carries to a new Revision only if it is still there. |
| `visited` | text | no | `"[]"` |  | The stages visited, as a JSON array. |
| `captions` | text | no | `"{}"` |  | Caption choices by stage, as JSON (app/lib/learner-session.ts). |
| `real_world` | text | no | `"{}"` |  | Real-world choices by Activity ID, as JSON; private, never part of completion (VID-12). |
| `completed_at` | integer | yes |  |  |  |
| `completed_revision_id` | text | yes |  | `learning_layer_revision.id` |  |
| `updated_at` | integer | no |  |  |  |

## learning_layer

A Learning Layer on a Video (ADR-0001): a stable parent row pointing at its current draft Revision, like a Content Item. A Video may have several, each on the whole video or an Excerpt.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `content_item_id` | text | no |  | `content_item.id` |  |
| `language_variety` | text | no |  |  | The Language Variety it teaches (Standard Fijian in 1a), which its language review must match. |
| `current_draft_revision_id` | text | yes |  | `learning_layer_revision.id` |  |
| `current_published_revision_id` | text | yes |  | `learning_layer_revision.id` |  |
| `publication_state` | text | no | `"unpublished"` |  | unpublished → published → withdrawn → archived, on its own, apart from its Video (ADR-0001). |
| `first_published_at` | integer | yes |  |  |  |
| `last_published_at` | integer | yes |  |  |  |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |
| `updated_at` | integer | no |  |  |  |

## learning_layer_approval

A Review Approval on one exact Learning Layer Revision: write-once like the Content Items' (a trigger refuses UPDATE). A Knowledge Holder Approval also records the Review Link they saw the Revision through and any private evidence of their approval, kept in the EVIDENCE bucket.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `revision_id` | text | no |  | `learning_layer_revision.id` |  |
| `review_type` | text | no |  |  |  |
| `language_variety` | text | yes |  |  |  |
| `decision` | text | no |  |  |  |
| `reviewer_id` | text | no |  |  | The reviewer; for a Knowledge Holder Approval, the editor who recorded it. |
| `scope` | text | yes |  |  |  |
| `notes` | text | yes |  |  |  |
| `knowledge_holder_name` | text | yes |  |  |  |
| `knowledge_holder_method` | text | yes |  |  |  |
| `conditions` | text | yes |  |  |  |
| `review_link_id` | text | yes |  | `review_link.id` |  |
| `evidence_asset_id` | text | yes |  | `media_asset.id` |  |
| `evidence_key` | text | yes |  |  |  |
| `evidence_name` | text | yes |  |  |  |
| `evidence_type` | text | yes |  |  |  |
| `carried_forward_from_id` | text | yes |  | `learning_layer_approval.id` |  |
| `decided_at` | integer | no |  |  |  |

## learning_layer_educator

An Educator assigned to a Learning Layer, who may open and author it (VAC-05).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `learning_layer_id` | text | no |  | `learning_layer.id` |  |
| `user_id` | text | no |  | `user.id` |  |
| `assigned_by` | text | no |  |  |  |
| `assigned_at` | integer | no |  |  |  |

## learning_layer_review_assignment

A reviewer asked to review a Learning Layer for one Review Type; it applies to all its Revisions.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `learning_layer_id` | text | no |  | `learning_layer.id` |  |
| `review_type` | text | no |  |  |  |
| `reviewer_id` | text | no |  |  |  |
| `assigned_by` | text | no |  |  |  |
| `assigned_at` | integer | no |  |  |  |

## learning_layer_revision

A write-once snapshot of a Learning Layer (ADR-0006): its title, level, Excerpt and Segments, with one fingerprint per Review Type. Segments keep their IDs from Revision to Revision.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `learning_layer_id` | text | no |  | `learning_layer.id` |  |
| `number` | integer | no |  |  |  |
| `snapshot` | text (JSON) | no |  |  |  |
| `fingerprints` | text (JSON) | no | set by the database |  |  |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |

## learning_layer_submission

An editor sending a Learning Layer Revision for review. Its existence makes the Revision "submitted".

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `revision_id` | text (primary key) | no |  | `learning_layer_revision.id` |  |
| `submitted_by` | text | no |  |  |  |
| `submitted_at` | integer | no |  |  |  |

## link_report

A visitor's report that a Resource's link is broken. No personal details: the reporter is only a keyed hash of their address and the day, so one person counts once a day.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `content_item_id` | text | no |  | `content_item.id` |  |
| `reporter_key` | text | no |  |  |  |
| `reported_at` | integer | no |  |  |  |

## media_asset

An uploaded file (docs/phase-1a-defaults.md §1, ADR-0010). Every upload lands in the private quarantine bucket; only once ClamAV passes it is it copied to its destination (the media library, or a Rights Record's private evidence) and marked ready. Status: uploading → scanning → ready, or → infected / failed (kept in quarantine, shown to staff with the reason) → removed after 30 days.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `purpose` | text | no |  |  | "media" (the media library) or "evidence" (a Rights Record's private evidence). |
| `type` | text | no |  |  | The accepted file type (app/lib/upload-rules.ts). |
| `name` | text | no |  |  |  |
| `size` | integer | no |  |  |  |
| `status` | text | no |  |  |  |
| `status_reason` | text | yes |  |  | Why an upload was refused or failed, or which signature ClamAV found, for staff to read. |
| `quarantine_key` | text | no |  |  |  |
| `multipart_upload_id` | text | yes |  |  | The R2 multipart upload, while the file is still arriving. |
| `destination_key` | text | no |  |  | Where a clean file is copied, in MEDIA or EVIDENCE according to its purpose. |
| `alt_text` | text | no | `""` |  |  |
| `uploaded_by` | text | no |  | `user.id` |  |
| `created_at` | integer | no |  |  |  |
| `updated_at` | integer | no |  |  |  |
| `scanned_at` | integer | yes |  |  | When the file was passed or refused; failures are removed 30 days after this. |

## media_upload_part

The parts of a multipart upload received so far, so an interrupted upload can resume.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `asset_id` | text | no |  | `media_asset.id` |  |
| `part_number` | integer | no |  |  |  |
| `etag` | text | no |  |  |  |
| `size` | integer | no |  |  |  |

## monitor_alert

An ongoing problem the monitor has told the technical owner about, until it clears (app/lib/monitor-rules.ts).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `check` | text (primary key) | no |  |  |  |
| `failing_since` | integer | no |  |  |  |
| `last_alerted_at` | integer | no |  |  |  |
| `summary` | text | no |  |  |  |

## newsletter_outbox

Newsletter changes, written here instead of sent to the newsletter tool in local development and tests.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | integer (primary key) | no | set by the database |  |  |
| `action` | text | no |  |  |  |
| `email` | text | no |  |  |  |
| `tags` | text (JSON) | no |  |  |  |
| `created_at` | integer | no |  |  |  |

## notice

The wording a person is shown when asked to consent to one purpose, one row per version. A new version is added, never an old one changed, so the exact words anyone agreed to are recoverable.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `purpose` | text | no |  |  |  |
| `version` | integer | no |  |  |  |
| `wording` | text | no |  |  |  |
| `published_by` | text | yes |  |  |  |
| `published_at` | integer | no |  |  |  |

## offering

A programme, course, resource or class a Provider offers, with exactly one access mode (PART-02).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `provider_id` | text | no |  | `provider.id` |  |
| `title` | text | no |  |  |  |
| `summary` | text | no | `""` |  |  |
| `language_variety` | text | no | `""` |  |  |
| `level` | text | no |  |  |  |
| `age_suitability` | text | no |  |  |  |
| `accessibility` | text | no | `""` |  |  |
| `format` | text | no |  |  |  |
| `cost` | text (JSON) | no |  |  |  |
| `cost_kind` | text | no |  |  | Kept beside `cost` so the listing can filter on it. |
| `starts_on` | text | no | `""` |  |  |
| `ends_on` | text | no | `""` |  |  |
| `access` | text (JSON) | no |  |  |  |
| `access_mode` | text | no |  |  | Kept beside `access` so the listing can filter on it. |
| `enrolment_by` | text | no |  |  |  |
| `support_by` | text | no |  |  |  |
| `listed` | integer | no | `false` |  |  |
| `sponsored_by` | text | yes |  |  |  |
| `feature_rationale` | text | yes |  |  |  |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |
| `updated_at` | integer | no |  |  |  |

## partnership_agreement

A recorded Partnership Agreement (CONTEXT.md, Partner): while one is in force, and only then, the Provider is shown as a Partner. Ended early by setting `endedAt`, never deleted.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `provider_id` | text | no |  | `provider.id` |  |
| `reference` | text | no |  |  | Where the signed agreement is kept, in words: "MOU signed 3 Sept 2026, founder's files". |
| `starts_on` | text | no |  |  |  |
| `ends_on` | text | yes |  |  | Its last day, or null when it runs until ended. |
| `ended_at` | integer | yes |  |  |  |
| `ended_by` | text | yes |  |  |  |
| `recorded_by` | text | no |  |  |  |
| `recorded_at` | integer | no |  |  |  |

## provider

An organisation or person whose learning Offerings are listed (CONTEXT.md, Provider). A plain listing editors keep: empty text means not known. Listing implies no partnership or endorsement.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `slug` | text (unique) | no |  |  | Its address under /connect/providers/; fixed when the Provider is added. |
| `name` | text | no |  |  |  |
| `description` | text | no | `""` |  |  |
| `organisation_type` | text | no |  |  |  |
| `location` | text | no | `""` |  |  |
| `website` | text | no | `""` |  |  |
| `contact_route` | text | no | `""` |  |  |
| `last_checked_on` | text | no |  |  |  |
| `listed` | integer | no | `false` |  | Shown on the public site. |
| `sponsored_by` | text | yes |  |  | Who sponsors this listing, disclosed wherever it is shown; null when nobody does. |
| `feature_rationale` | text | yes |  |  | Why editors feature it (PUB-04); featured exactly when this is set. |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |
| `updated_at` | integer | no |  |  |  |

## rate_limit

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `key` | text (unique) | no |  |  |  |
| `count` | integer | no |  |  |  |
| `last_request` | integer | no |  |  |  |

## review_approval

A Review Approval: one decision, for one Review Type, on one exact Revision. Write-once like Revisions (a trigger refuses UPDATE). Also holds Knowledge Holder Approvals, recorded by an editor, and Carried-forward Approvals, which point at the approval they carry.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `revision_id` | text | no |  | `revision.id` |  |
| `review_type` | text | no |  |  |  |
| `language_variety` | text | yes |  |  |  |
| `decision` | text | no |  |  |  |
| `reviewer_id` | text | no |  |  | The reviewer; for a Knowledge Holder Approval, the editor who recorded it. |
| `scope` | text | yes |  |  | What the reviewer looked at, in their words. |
| `notes` | text | yes |  |  |  |
| `knowledge_holder_name` | text | yes |  |  |  |
| `knowledge_holder_method` | text | yes |  |  | How the Knowledge Holder gave their approval (in person, by phone…). |
| `conditions` | text | yes |  |  |  |
| `review_link_id` | text | yes |  | `review_link.id` | A Knowledge Holder Approval: the Review Link they saw this Revision through, and any private evidence of their approval (the same columns a Learning Layer's approvals have). Approvals recorded before Review Links covered Content Items have neither. |
| `evidence_asset_id` | text | yes |  | `media_asset.id` |  |
| `evidence_key` | text | yes |  |  |  |
| `evidence_name` | text | yes |  |  |  |
| `evidence_type` | text | yes |  |  |  |
| `carried_forward_from_id` | text | yes |  | `review_approval.id` |  |
| `decided_at` | integer | no |  |  |  |

## review_assignment

A reviewer asked to review a Content Item for one Review Type; it applies to all its Revisions.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `content_item_id` | text | no |  | `content_item.id` |  |
| `review_type` | text | no |  |  |  |
| `reviewer_id` | text | no |  |  |  |
| `assigned_by` | text | no |  |  |  |
| `assigned_at` | integer | no |  |  |  |

## review_link

A view-only link to one exact Learning Layer Revision for someone without a staff account, such as a Knowledge Holder. Only a hash of its token is kept. It lasts 14 days and can be revoked.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `revision_id` | text | yes |  | `learning_layer_revision.id` | The Learning Layer Revision it shows. Exactly one of this and `contentRevisionId` is set. |
| `content_revision_id` | text | yes |  | `revision.id` | The Content Item Revision (an article, Episode, Video…) it shows. |
| `token_hash` | text | no |  |  |  |
| `recipient` | text | no |  |  | Who it was made for, in the editor's words. |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |
| `expires_at` | integer | no |  |  |  |
| `revoked_at` | integer | yes |  |  |  |
| `revoked_by` | text | yes |  |  |  |

## review_link_access

One opening of a Review Link, whether it still worked or not.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `review_link_id` | text | no |  | `review_link.id` |  |
| `outcome` | text | no |  |  | "viewed", or why not: "expired" or "revoked". |
| `accessed_at` | integer | no |  |  |  |

## revision

One save of a Content Item: a full snapshot of everything the editor wrote. Never updated in place; a database trigger (migrations/0002) refuses any UPDATE.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `content_item_id` | text | no |  | `content_item.id` |  |
| `number` | integer | no |  |  | 1, 2, 3… within its Content Item, in save order. |
| `snapshot` | text (JSON) | no |  |  |  |
| `fingerprints` | text (JSON) | no | set by the database |  | One hash per Review Type over the fields it covers, taken when the Revision is written (ADR-0006). |
| `restored_from_revision_id` | text | yes |  |  | Set when this Revision was made by restoring an earlier one. |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |

## revision_submission

An editor sending a Revision for review. Its existence is what makes the Revision "submitted".

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `revision_id` | text (primary key) | no |  | `revision.id` |  |
| `submitted_by` | text | no |  |  |  |
| `submitted_at` | integer | no |  |  |  |

## rights_expiry_warning

Expiry warnings already emailed, so each window warns once.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `rights_record_id` | text | no |  | `rights_record.id` |  |
| `within_days` | integer | no |  |  |  |
| `sent_at` | integer | no |  |  |  |

## rights_record

The legal permission for a contributed work or media asset. Records are never edited (a trigger allows only withdrawal): a mistake is corrected by withdrawing the record and recording a new one. The evidence file lives in the private EVIDENCE bucket under `evidenceKey` and is never served publicly.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `subject_type` | text | no |  |  | What the record covers: "content_item" now; media assets join with the media library. |
| `subject_id` | text | no |  |  |  |
| `part_kind` | text | yes |  |  | A part of the subject with rights of its own (speaker, music, archive clip); null for all of it. |
| `part_name` | text | yes |  |  | Which speaker, piece of music or clip, as staff name it. |
| `rights_holder` | text | no |  |  |  |
| `permitted_uses` | text (JSON) | no |  |  |  |
| `guardian_permission` | integer | no | `false` |  |  |
| `evidence_key` | text | no |  |  |  |
| `evidence_name` | text | no |  |  |  |
| `evidence_type` | text | no |  |  |  |
| `evidence_asset_id` | text | yes |  | `media_asset.id` | The scanned upload behind the evidence; null for evidence stored before the scan pipeline (#14). |
| `expires_at` | integer | yes |  |  |  |
| `withdrawn_at` | integer | yes |  |  |  |
| `withdrawn_by` | text | yes |  |  |  |
| `withdrawal_reason` | text | yes |  |  |  |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |

## rights_record_contributor

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `rights_record_id` | text | no |  | `rights_record.id` |  |
| `contributor_id` | text | no |  | `contributor.id` |  |

## role_assignment

A staff role granted to a user. Revoking sets revokedAt; rows are never deleted.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `user_id` | text | no |  | `user.id` |  |
| `role` | text | no |  |  |  |
| `review_type` | text | yes |  |  |  |
| `language_variety` | text | yes |  |  |  |
| `granted_by` | text | yes |  |  |  |
| `granted_at` | integer | no |  |  |  |
| `revoked_by` | text | yes |  |  |  |
| `revoked_at` | integer | yes |  |  |  |

## saved_vocabulary

An Expression a learner saved from a Learning Layer Revision. The Revision's copy of the Expression is what they saw; the library's may since have changed (ADR-0006).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `user_id` | text | no |  | `user.id` |  |
| `expression_id` | text | no |  | `expression.id` |  |
| `source_revision_id` | text | no |  | `learning_layer_revision.id` |  |
| `learning_layer_id` | text | no |  | `learning_layer.id` |  |
| `saved_at` | integer | no |  |  |  |

## search_entry

The public search index (PUB-03, ADR-0007): one row per item whose published Revision was eligible when it was last indexed, mirrored into the `search_fts` full-text table by triggers (migrations/0006). Every hit is checked for eligibility again before it is shown.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | integer (primary key) | no | set by the database |  | The full-text index's rowid; kept stable by being declared. |
| `content_item_id` | text (unique) | no |  | `content_item.id` |  |
| `primary_area` | text | no |  |  |  |
| `format` | text | no |  |  | The item's type (content_item.type), which visitors filter by as its format. |
| `title` | text | no |  |  |  |
| `summary` | text | no |  |  |  |
| `topic_names` | text | no |  |  | The item's Topic names, so searching for a Topic's name finds the items in it. |
| `published_at` | integer | yes |  |  |  |

## search_entry_topic

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `content_item_id` | text | no |  | `content_item.id` |  |
| `topic_id` | text | no |  | `topic.id` |  |

## server_error

A request the Worker answered with a 5xx or failed outright (workers/app.ts), for the monitor's error rate. Only when: Cloudflare's own error count misses the 500s React Router answers with.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | integer (primary key) | no | set by the database |  |  |
| `failed_at` | integer | no |  |  |  |

## session

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `token` | text (unique) | no |  |  |  |
| `user_id` | text | no |  | `user.id` |  |
| `expires_at` | integer | no |  |  |  |
| `ip_address` | text | yes |  |  |  |
| `user_agent` | text | yes |  |  |  |
| `created_at` | integer | no | set by the database |  |  |
| `updated_at` | integer | no | set by the database |  |  |

## site_settings

Site-wide settings the founder controls, such as the site name and welcome statement (PRD §08).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `key` | text (primary key) | no |  |  |  |
| `value` | text | no |  |  |  |
| `updated_at` | integer | no |  |  |  |

## slug_redirect

An old URL of a Content Item, kept when its slug changes so the old address answers with a 301.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `primary_area` | text | no |  |  |  |
| `slug` | text | no |  |  |  |
| `content_item_id` | text | no |  | `content_item.id` |  |
| `created_at` | integer | no |  |  |  |

## staff_session

Staff state per signed-in session (ADR-0013): whether it has passed the two-factor check, and how many wrong codes it has submitted (Better Auth does not limit attempts for an existing session, so the staff gate does).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `session_id` | text (primary key) | no |  | `session.id` |  |
| `user_id` | text | no |  |  |  |
| `verified_at` | integer | yes |  |  |  |
| `failed_attempts` | integer | no | `0` |  |  |

## submission

Anything a member of the public sends through a form (CONTEXT.md, Submission). It goes to the staff queue and is never published. The consents given with it are kept apart, in consent_record.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `type` | text | no |  |  |  |
| `form_key` | text (unique) | no |  |  | A key the form was rendered with: sending the same form twice stores it once. |
| `name` | text | no |  |  |  |
| `email` | text | no |  |  |  |
| `fields` | text (JSON) | no |  |  |  |
| `status` | text | no | `"new"` |  |  |
| `owner_id` | text | yes |  |  | The staff member working it. |
| `due_on` | text | no |  |  | The day, YYYY-MM-DD, it should be answered by. |
| `confirmed_at` | integer | yes |  |  | When the confirmation email went; null if it couldn't be sent. |
| `received_at` | integer | no |  |  |  |
| `updated_at` | integer | no |  |  |  |

## topic

A subject Content Items are tagged with. Topic pages arrive with 1a-18.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `slug` | text (unique) | no |  |  |  |
| `name` | text | no |  |  |  |
| `description` | text | no | `""` |  | Shown at the top of the Topic's page (FOR-06). |
| `parent_topic_id` | text | yes |  | `topic.id` | A broader Topic this one sits under, as a subtopic; filters on the parent's page. |
| `lead_item_id` | text | yes |  | `content_item.id` | The Content Item featured first on the Topic's page, chosen by an editor. |
| `created_by` | text | no |  |  |  |
| `created_at` | integer | no |  |  |  |

## two_factor

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `secret` | text | no |  |  |  |
| `backup_codes` | text | no |  |  |  |
| `user_id` | text | no |  | `user.id` |  |
| `verified` | integer | yes | `false` |  |  |
| `failed_verification_count` | integer | yes | `0` |  |  |
| `locked_until` | integer | yes |  |  |  |

## upload_link

A single-use, expiring link an editor sends so a contributor can upload the material they proposed (docs/phase-1a-defaults.md §4). Files go to quarantine and are scanned like any upload; the link stops working once the contributor finishes or it expires. Only the token's hash is kept.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `submission_id` | text | no |  | `submission.id` |  |
| `token_hash` | text (unique) | no |  |  |  |
| `issued_by` | text | no |  |  |  |
| `issued_at` | integer | no |  |  |  |
| `expires_at` | integer | no |  |  |  |
| `finished_at` | integer | yes |  |  |  |

## upload_link_file

The files that arrived through an upload link.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `asset_id` | text (primary key) | no |  | `media_asset.id` |  |
| `link_id` | text | no |  | `upload_link.id` |  |

## usage_month

A month's media usage (VAC-10), refreshed daily from Cloudflare's figures for the whole account. Its cost is worked out from these when shown (app/lib/usage-rules.ts).

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `month` | text (primary key) | no |  |  | The calendar month in UTC, as "2026-10". |
| `stored_minutes` | real | no |  |  | Minutes of video Stream holds, at the latest reading. |
| `delivered_minutes` | real | no |  |  | Minutes of video Stream delivered so far this month. |
| `r2_bytes` | integer | no |  |  | Bytes held in R2, across every bucket, at the latest reading. |
| `recorded_at` | integer | no |  |  |  |
| `budget_alert_percent` | integer | no | `0` |  | The highest budget alert sent this month (50 or 80 per cent of the ceiling), or 0. |

## user

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `name` | text | no |  |  |  |
| `email` | text (unique) | no |  |  |  |
| `email_verified` | integer | no | `false` |  |  |
| `image` | text | yes |  |  |  |
| `two_factor_enabled` | integer | yes | `false` |  |  |
| `created_at` | integer | no | set by the database |  |  |
| `updated_at` | integer | no | set by the database |  |  |

## verification

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  |  |  |
| `identifier` | text | no |  |  |  |
| `value` | text | no |  |  |  |
| `expires_at` | integer | no |  |  |  |
| `created_at` | integer | no | set by the database |  |  |
| `updated_at` | integer | no | set by the database |  |  |

## video_asset

A Video Asset (ADR-0008): a scanned video master kept in the private VIDEO_MASTERS bucket as NAISEMA's original, and the copy a video provider (Cloudflare Stream) made of it for delivery. It shares its ID with the media library upload it came from. Its length and picture size are read from the master itself; the provider's reports only move its state forwards.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `id` | text (primary key) | no |  | `media_asset.id` |  |
| `owner_id` | text | no |  | `user.id` |  |
| `master_key` | text | no |  |  | The master's key in VIDEO_MASTERS. |
| `provider` | text | no |  |  | Which provider holds the delivery copy ("stream", or "local" in development and tests). |
| `provider_id` | text | yes |  |  | The provider's ID for its copy, such as a Stream video UID, once one was asked for. |
| `state` | text | no |  |  |  |
| `state_reason` | text | yes |  |  | Why processing failed, for staff to read; never carries addresses or credentials. |
| `duration_ms` | integer | no |  |  |  |
| `width` | integer | no |  |  |  |
| `height` | integer | no |  |  |  |
| `orientation` | text | no |  |  |  |
| `environment` | text | no |  |  | The environment that sent it (development, staging or production), as one Stream account serves them all. |
| `created_at` | integer | no |  |  |  |
| `updated_at` | integer | no |  |  |  |
| `ready_at` | integer | yes |  |  |  |

## video_educator

An Educator an editor assigned to a Video, who may then add Learning Layers to it.

| Column | Type | Can be empty | Default | References | Purpose |
| --- | --- | --- | --- | --- | --- |
| `content_item_id` | text | no |  | `content_item.id` |  |
| `user_id` | text | no |  | `user.id` |  |
| `assigned_by` | text | no |  |  |  |
| `assigned_at` | integer | no |  |  |  |
