// Writes e2e/seed.sql: the staff, a published Video with its Learning Layer, its footage and
// rights, as the browser tests expect them (playwright.config.ts loads it into local D1).
import { writeFileSync } from "node:fs";

const EDITOR = "e2e-editor@naisema.test";
const REVIEWER = "e2e-reviewer@naisema.test";
const AUTHOR = "e2e-educator@naisema.test";
const ITEM = "e2e00000-0000-4000-8000-000000000001";
const REVISION = "e2e00000-0000-4000-8000-000000000002";
const MEDIA = "e2e00000-0000-4000-8000-000000000003";
const SEGMENTS = ["e2e00000-0000-4000-8000-0000000000a1", "e2e00000-0000-4000-8000-0000000000a2"];
const EXPRESSION = "e2e00000-0000-4000-8000-0000000000e1";
const ACTIVITY = "e2e00000-0000-4000-8000-0000000000c1";

const layer = {
  title: "Greetings at the market",
  level: "beginner",
  flags: [],
  excerpt: null,
  segments: [
    {
      id: SEGMENTS[0],
      startMs: 0,
      endMs: 4000,
      speaker: "Mere",
      fijian: "Bula vinaka",
      english: "Hello there",
      overlapIntended: false,
      draft: false,
      retimed: false,
      tokens: [
        { id: "tok-bula", text: "Bula" },
        { id: "tok-vinaka", text: "vinaka" },
      ],
    },
    {
      id: SEGMENTS[1],
      startMs: 4000,
      endMs: 9000,
      speaker: "Seru",
      fijian: "Au via voli ika",
      english: "I'd like to buy fish",
      overlapIntended: false,
      draft: false,
      retimed: false,
      tokens: [
        { id: "tok-au", text: "Au" },
        { id: "tok-via", text: "via" },
        { id: "tok-voli", text: "voli" },
        { id: "tok-ika", text: "ika" },
      ],
    },
  ],
  annotations: [
    {
      id: "ann-ika",
      segmentId: SEGMENTS[1],
      startTokenId: "tok-ika",
      endTokenId: "tok-ika",
      expressionId: EXPRESSION,
      contextualMeaning: "fish, at the market stall",
      grammarNote: "",
      inVocabulary: true,
      needsCheck: false,
    },
  ],
  notes: [
    {
      id: "note-market",
      segmentId: null,
      kind: "cultural",
      text: "Markets open early on Saturday mornings.",
      attribution: "Mere, a market vendor in Suva",
    },
  ],
  expressions: {
    [EXPRESSION]: {
      headword: "ika",
      generalMeaning: "fish",
      grammarNote: "",
      pronunciation: "EE-ka",
      literalMeaning: null,
    },
  },
  activities: [
    {
      id: ACTIVITY,
      kind: "comprehension",
      segmentId: SEGMENTS[1],
      prompt: "What does Seru want to buy?",
      options: [
        { id: "e2e00000-0000-4000-8000-0000000000d1", text: "Fish", correct: true },
        { id: "e2e00000-0000-4000-8000-0000000000d2", text: "Taro", correct: false },
      ],
      modelResponse: "",
      feedback: "Ika is fish.",
      pronunciation: "",
      required: true,
      textAlternative: "Read line 2, then choose what Seru wants to buy.",
    },
  ],
};

const body = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Saturday at the market in Suva." }] }],
};
const q = (value) => (value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`);
const json = (value) => q(JSON.stringify(value));
const now = Date.parse("2026-11-01T00:00:00Z");

const sql = `
INSERT INTO staff (email, name, roles, language_variety) VALUES
  (${q(EDITOR)}, 'E2E Editor', '["editor","admin"]', NULL),
  (${q(REVIEWER)}, 'E2E Reviewer', '["reviewer"]', 'standard-fijian'),
  (${q(AUTHOR)}, 'E2E Educator', '["educator"]', NULL);
INSERT INTO media (id, kind, key, content_type, bytes, filename, width, height, duration_ms, uploaded_by) VALUES
  (${q(MEDIA)}, 'video', 'media/e2e-market', 'video/mp4', 421464, 'market.mp4', 240, 426, 10000, ${q(AUTHOR)});
INSERT INTO content_item (id, kind, area, slug, title, state, published_revision_id, search_text, published_at, updated_at) VALUES
  (${q(ITEM)}, 'video', 'learn', 'e2e-market-talanoa', 'Talanoa at the market', 'published', ${q(REVISION)}, 'talanoa at the market', ${now}, ${now});
INSERT INTO revision (id, item_id, number, title, summary, credit, flags, topics, body, fields, layer, media_ids, author_email) VALUES
  (${q(REVISION)}, ${q(ITEM)}, 2, 'Talanoa at the market', 'Mere and Seru at the Suva market.', 'NAISEMA', '[]', '[]', ${json(body)}, ${json({ videoMediaId: MEDIA })}, ${json(layer)}, ${json([MEDIA])}, ${q(AUTHOR)});
INSERT INTO review (id, revision_id, type, decision, reviewer_email) VALUES
  ('e2e-review-editorial', ${q(REVISION)}, 'editorial', 'approved', ${q(EDITOR)}),
  ('e2e-review-language', ${q(REVISION)}, 'language', 'approved', ${q(REVIEWER)});
INSERT INTO rights_record (id, subject_type, subject_id, holder, permitted_uses, created_by) VALUES
  ('e2e-rights-item', 'item', ${q(ITEM)}, 'Mere and Seru', '["publish","translate","transcribe","educationalAdaptation"]', ${q(EDITOR)}),
  ('e2e-rights-footage', 'media', ${q(MEDIA)}, 'Mere and Seru', '["publish"]', ${q(EDITOR)});
`;
writeFileSync(new URL("./seed.sql", import.meta.url), sql.trimStart());
