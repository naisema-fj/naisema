# Exports

What NAISEMA can export, who can run each export, and what the files hold (CMS-05, VCMS-06, OWN-03). Exports are run from the staff area, under **Exports** (`/admin/exports`). Each one downloads as one JSON file named `naisema-<kind>-<YYYY-MM-DD>.json`. The code is in `app/lib/exports.server.ts` and `app/lib/learning-layer-bundle.server.ts`.

## Who runs which export

| Export | Format | Who | Notes |
| --- | --- | --- | --- |
| Content Items and their Revisions | `naisema.content` | Editors | |
| Rights Records | `naisema.rights` | Editors | Evidence files stay in the private `EVIDENCE` bucket. The export holds only their names and keys. |
| Review submissions, assignments, approvals and Review Links | `naisema.approvals` | Editors | |
| One Learning Layer, complete | `naisema.learning-layer` | Editors | Can be imported into another database (below). |
| The audit log | `naisema.audit` | Administrators | |
| Contacts from the public forms | `naisema.contacts` | Privacy contact | Needs a stated purpose of at least 10 characters. |

Every export is recorded in the audit log as `export.downloaded`, with who ran it, the kind (the object ID, or the Learning Layer's ID), and counts of what it held. For contacts, the stated purpose is recorded as the event's reason. The founder holds all three roles, so can run every export.

## Common shape

Every file is one JSON object starting with:

```json
{
  "format": "naisema.content",
  "version": 1,
  "exportedAt": "2026-10-06T04:12:00.000Z",
  "exportedBy": "<user ID>"
}
```

`format` says what the file is, and `version` says which version of that format. A change that would stop an older reader from reading a file raises `version`, and this page records the change.

- **Times:** in `naisema.content`, `naisema.rights`, `naisema.approvals`, `naisema.audit` and `naisema.contacts`, times are ISO 8601 in UTC. In `naisema.learning-layer` rows, times are numbers of milliseconds since 1970 (UTC), as the database stores them.
- **IDs:** every row keeps its database ID, so files exported on different days can be joined. People are named by user ID. The audit log, or the staff page, says who an ID is.

## `naisema.content`

- `topics`: every Topic (`id`, `slug`, `name`, `description`, `parentTopicId`, `leadItemId`…).
- `items`: every Content Item, oldest first. Each item has:
  - The `content_item` row: `id`, `type` (article, resource, episode, creator, video, page), `slug`, `primaryArea`, `publicationState` (unpublished, published, withdrawn, archived), `currentDraftRevisionId`, `currentPublishedRevisionId`, and the dates.
  - `path`: its public address.
  - `oldPaths`: addresses that redirect to it.
  - `revisions`: every Revision in save order. Each has `id`, `number`, `snapshot` (everything the editor wrote, below), `fingerprints` (one hash per Review Type, ADR-0006), `restoredFromRevisionId`, `createdBy`, `createdAt`, `submitted` (`{ by, at }` or null), and `html`.
- `html`: the body rendered by the same allowlist renderer as the public site. Embedded items link to their public address and show their latest title.

### A Revision's `snapshot`

`title`, `summary`, `credit`, `topicIds`, `body`, `sources`, `flags` (Content Flags), `languageVariety`, `relatedIds`. Some types have their own part:

- `resource`: a Resource's file or link, and its usage terms.
- `episode`: an Episode's recording, people, music, archive clips, transcript and distribution links.
- `creator`: a Creator Profile's details, portrait and free sample.
- `video`: a Video's `videoAssetId`.

Media library files appear as `/media/images/<id>/<width>` or `/media/files/<id>` addresses, or as IDs.

### Body JSON (Tiptap / ProseMirror)

A body is `{ "type": "doc", "content": [blocks] }`. Only these nodes are stored; anything else is refused when saved (`app/lib/article-body.ts`).

| Node | Shape |
| --- | --- |
| Paragraph | `{ "type": "paragraph", "content": [inline] }` (content may be missing when empty) |
| Heading | `{ "type": "heading", "attrs": { "level": 2 \| 3 \| 4 }, "content": [inline] }` |
| Bulleted list | `{ "type": "bulletList", "content": [listItem] }` |
| Numbered list | `{ "type": "orderedList", "attrs": { "start": n }, "content": [listItem] }` |
| List item | `{ "type": "listItem", "content": [blocks] }` |
| Quote | `{ "type": "blockquote", "content": [blocks] }` |
| Image | `{ "type": "image", "attrs": { "src": "https://…", "alt": "…" } }` (alt text required) |
| Embedded item | `{ "type": "contentItem", "attrs": { "id": "<Content Item ID>" } }` |
| Callout | `{ "type": "callout", "content": [paragraph] }` |
| Text | `{ "type": "text", "text": "…", "marks": [mark] }` |
| Line break | `{ "type": "hardBreak" }` |
| Marks | `{ "type": "bold" }`, `{ "type": "italic" }`, `{ "type": "link", "attrs": { "href": "https:…, http:… or mailto:…" } }` |

## `naisema.rights`

- `contributors`: `id`, `name`, `notes`, and who added them and when.
- `records`: every Rights Record, current or withdrawn, oldest first. Each has:
  - `subjectType` (`content_item` or `media_asset`) and `subjectId`.
  - `partKind` and `partName`, for a speaker, music or archive clip with rights of its own. Both are null for the whole item.
  - `rightsHolder` and `permittedUses` (publish, excerpt, translate, transcribe, educationalAdaptation, commercial, aiTraining).
  - `guardianPermission`.
  - `evidenceKey`, `evidenceName`, `evidenceType` and `evidenceAssetId`: the file in `EVIDENCE`, not its contents.
  - `expiresAt`, `withdrawnAt`, `withdrawnBy` and `withdrawalReason`.
  - `createdBy`, `createdAt` and `contributorIds`.

## `naisema.approvals`

There are two halves: `contentItems` and `learningLayers`. Their tables are kept apart (ADR-0001).

- **Both halves:**
  - `submissions`: `revisionId`, `submittedBy` and `submittedAt`.
  - `assignments`: who was asked to review which item or Learning Layer, for which Review Type.
  - `approvals`: every decision on an exact Revision. Each has `reviewType`, `languageVariety`, `decision` (approved or rejected), `reviewerId`, `scope`, `notes`, the Knowledge Holder's name and how they gave their approval, `conditions`, `carriedForwardFromId` and `decidedAt`. For a Knowledge Holder Approval, `reviewerId` is the editor who recorded it.
- **Learning Layer approvals only:** these also have `reviewLinkId` and the evidence's `evidenceKey` and `evidenceName`.
- **`learningLayers` only:**
  - `reviewLinks`: who each link was for, and when it was made, expires and was revoked. Never its token.
  - `reviewLinkOpenings`: every opening, with its outcome (viewed, expired or revoked).

## `naisema.audit`

`events`: the whole audit log, oldest first. Each event has `id`, `actorId` (null for the system or a member of the public), `action`, `objectType`, `objectId`, `details` and `createdAt`.

- `details` holds IDs, kinds and outcomes, never form bodies, Case contents or secrets.
- `details.reason`, where present, is why. It may come from the person who acted, or from the code that refused.

The audit log is append-only: the database refuses changes and deletions (migration 0020). Administrators can also read it at `/admin/audit`, filtered by object, person and action.

## `naisema.contacts`

- `purpose`: the purpose the privacy contact stated.
- `notices`: every consent notice version, with its words.
- `submissions`: everything sent through the public forms, with `name`, `email` and `fields`.
- `consentRecords`: what each address agreed to, under which notice, and any withdrawal.

People who came through a report, rights concern or data request aren't included. Their Cases are handled in the Case queue.

## `naisema.learning-layer`

One Learning Layer, with everything needed to rebuild it in an empty database and play it there. The test `tests/integration/learning-layer-export.test.ts` imports one into an empty D1 and checks it plays identically.

| Field | What it holds |
| --- | --- |
| `learningLayerId`, `videoId` | The Learning Layer and the Video it is on. |
| `heldAtExport` | True when the Video was hidden pending a Case. The hold belongs to the Case and isn't exported, so an import brings the Video and Learning Layer in withdrawn. |
| `captions` | For each Learning Layer Revision ID, `{ fijian, english }` as WebVTT in the video's own time. The cue IDs are Segment IDs. These are derived from the Segments and aren't imported. |
| `tables` | `[{ table, rows }]` in the order rows can be inserted. Rows are the database's own: column names as in `db/schema.ts`, times in milliseconds, booleans as 0 or 1. JSON columns (`snapshot`, `fingerprints`, `permitted_uses`, `details`, `fields`) are nested JSON. |

The tables, in order:

1. **`user`:** only the staff the rows must point at, by ID and name. Each address is `<id>@exported.invalid`, which can't receive a sign-in link.
2. **`media_asset`, `video_asset`:** the Video's footage and any media in its body, plus the evidence files behind its Rights Records and Knowledge Holder Approvals. Each row has its keys in R2 (`destination_key`, `master_key`) and Stream's ID for its copy (`provider_id`).
3. **`contributor`, `content_item`, `revision`, `revision_submission`, `review_assignment`, `review_approval`:** the Video with every Revision and its review.
4. **`rights_record`, `rights_record_contributor`:** Rights Records on the Video and on its files.
5. **`video_educator`, `expression`:** the Educators assigned to the Video, and the library rows of every Expression the Learning Layer's Revisions use.
6. **The Learning Layer's own rows:**
   - `learning_layer` and `learning_layer_revision`. Each Revision's `snapshot` holds `title`, `level`, `flags`, `excerpt` and `segments`. Each Segment has its `tokens`, each with a stable ID. The snapshot also holds `annotations` (pointing at token IDs and an Expression ID), `notes`, `expressions` (the copies that Revision reviewed) and `activities` (with their choices' IDs).
   - `learning_layer_educator`, `learning_layer_submission` and `learning_layer_review_assignment`.
   - `review_link`, with `token_hash` replaced by `exported:<id>`, so no imported link can be opened.
   - `review_link_access` and `learning_layer_approval`.

### Importing a Learning Layer

Import into an empty environment, such as staging after a reset:

1. Copy the files the rows name into the target's buckets:
   - `video_asset.master_key` into `VIDEO_MASTERS`.
   - `media_asset.destination_key` into `MEDIA` or `EVIDENCE`, by the row's `purpose`.

   In the same Cloudflare account, `provider_id` is already Stream's copy. In another account, retry the video from its media page once imported, so a new copy is made from the master.
2. Run `pnpm learning-layer:import --env staging --file <export>.json`. Use `--local` for the local database.

What the import keeps and refuses:

- Rows already in the database for the Video, its files and the Expression library are kept as they are. A second Learning Layer on the same Video imports beside the first.
- A Learning Layer that is already there refuses the import.
- The script writes only the tables listed above.

`wrangler d1 execute` can't undo a file that fails part-way, so import only into a database you can reset, or note the time first for Time Travel.

Inside a Worker or a test, `importLearningLayerBundle(env.DB, bundle)` imports the same file in one transaction. `scripts/import-learning-layer.mjs` mirrors its statements: change both together.
