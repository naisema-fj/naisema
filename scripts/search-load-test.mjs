// The public search load test (issue #21: p95 ≤ 2 s against a 5,000-item catalogue on staging).
//
//   pnpm search:load-test seed --env staging --count 5000
//   pnpm search:load-test run --url https://staging.naisema.com --requests 300 --concurrency 10
//   pnpm search:load-test remove --env staging
//
// `seed` writes published, eligible Articles (no flags, a Rights Record granting Publish) with IDs
// starting "load-", already indexed for search; `remove` deletes exactly those. Both also take
// --local. They refuse production. `run` searches with random words and filters, prints the
// latency percentiles, and exits 1 if p95 is over the target.
import { parseArgs } from "node:util";
import { executeSql, fail, requireTarget } from "./lib/staff-cli.mjs";

const TARGET_P95_MS = 2000;
const AREAS = ["learn", "voices", "discover", "connect", "ezine", "resources"];
const WORDS = [
  "bula",
  "vinaka",
  "sevusevu",
  "yaqona",
  "vanua",
  "koro",
  "lali",
  "masi",
  "lovo",
  "meke",
  "talanoa",
  "vosa",
  "vuli",
  "veiwekani",
  "magiti",
  "tabua",
  "drua",
  "vale",
  "loloma",
  "qoli",
  "teitei",
  "solevu",
  "greeting",
  "village",
  "family",
  "ceremony",
  "story",
  "song",
  "fishing",
  "garden",
  "feast",
  "journey",
];

const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: {
    env: { type: "string" },
    local: { type: "boolean", default: false },
    count: { type: "string", default: "5000" },
    url: { type: "string" },
    requests: { type: "string", default: "300" },
    concurrency: { type: "string", default: "10" },
  },
});

const pick = (list, index) => list[index % list.length];
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

/** INSERT statements of at most 100 rows each, so no single statement is too large for D1. */
function inserts(table, columns, rows) {
  const statements = [];
  for (let start = 0; start < rows.length; start += 100) {
    const values = rows.slice(start, start + 100).map((row) => `(${row.map(quote).join(", ")})`);
    statements.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values.join(",\n")};`);
  }
  return statements;
}

function seedSql(count) {
  const now = Date.now();
  const topics = Array.from({ length: 24 }, (_, index) => [
    `load-topic-${index}`,
    `load-topic-${index}`,
    `Load ${pick(WORDS, index * 7)} ${index}`,
    "load-test",
    now,
  ]);
  const items = Array.from({ length: count }, (_, index) => {
    const title = `${pick(WORDS, index)} ${pick(WORDS, index * 3 + 1)} ${pick(WORDS, index * 5 + 2)} ${index}`;
    const summary = `A load-test piece about ${pick(WORDS, index * 11)} and ${pick(WORDS, index * 13 + 4)}.`;
    const topic = topics[index % topics.length];
    return { id: `load-item-${index}`, area: pick(AREAS, index), title, summary, topic, at: now - index * 60_000 };
  });
  const snapshot = (item) =>
    JSON.stringify({
      title: item.title,
      summary: item.summary,
      credit: "Load test",
      topicIds: [item.topic[0]],
      body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: item.summary }] }] },
      sources: "",
      flags: [],
      languageVariety: null,
    });
  return [
    ...inserts("topic", ["id", "slug", "name", "created_by", "created_at"], topics),
    ...inserts(
      "content_item",
      [
        "id",
        "type",
        "slug",
        "primary_area",
        "created_by",
        "created_at",
        "updated_at",
        "publication_state",
        "first_published_at",
        "last_published_at",
      ],
      items.map((item) => [
        item.id,
        "article",
        item.id,
        item.area,
        "load-test",
        item.at,
        item.at,
        "published",
        item.at,
        item.at,
      ]),
    ),
    ...inserts(
      "revision",
      ["id", "content_item_id", "number", "snapshot", "fingerprints", "created_by", "created_at"],
      items.map((item) => [`${item.id}-r1`, item.id, 1, snapshot(item), "{}", "load-test", item.at]),
    ),
    "UPDATE content_item SET current_draft_revision_id = id || '-r1', current_published_revision_id = id || '-r1' WHERE id LIKE 'load-item-%';",
    ...inserts(
      "revision_submission",
      ["revision_id", "submitted_by", "submitted_at"],
      items.map((item) => [`${item.id}-r1`, "load-test", item.at]),
    ),
    ...inserts(
      "rights_record",
      [
        "id",
        "subject_type",
        "subject_id",
        "rights_holder",
        "permitted_uses",
        "guardian_permission",
        "evidence_key",
        "evidence_name",
        "evidence_type",
        "created_by",
        "created_at",
      ],
      items.map((item) => [
        `${item.id}-rights`,
        "content_item",
        item.id,
        "Load test",
        '["publish"]',
        0,
        "rights/load-test",
        "load.pdf",
        "application/pdf",
        "load-test",
        item.at,
      ]),
    ),
    ...inserts(
      "search_entry",
      ["content_item_id", "primary_area", "format", "title", "summary", "topic_names", "published_at"],
      items.map((item) => [item.id, item.area, "article", item.title, item.summary, item.topic[2], item.at]),
    ),
    ...inserts(
      "search_entry_topic",
      ["content_item_id", "topic_id"],
      items.map((item) => [item.id, item.topic[0]]),
    ),
  ].join("\n");
}

const REMOVE_SQL = `
DELETE FROM search_entry_topic WHERE content_item_id LIKE 'load-item-%';
DELETE FROM search_entry WHERE content_item_id LIKE 'load-item-%';
DELETE FROM rights_record WHERE id LIKE 'load-item-%';
DELETE FROM revision_submission WHERE revision_id LIKE 'load-item-%';
UPDATE content_item SET current_draft_revision_id = NULL, current_published_revision_id = NULL WHERE id LIKE 'load-item-%';
DELETE FROM revision WHERE id LIKE 'load-item-%';
DELETE FROM content_item WHERE id LIKE 'load-item-%';
DELETE FROM topic WHERE id LIKE 'load-topic-%';
`;

function seedTarget() {
  if (values.env === "production") fail("The load test never touches production.");
  return requireTarget(values);
}

async function run() {
  if (!values.url) fail("Pass --url, for example https://staging.naisema.com.");
  const total = Number(values.requests);
  const concurrency = Number(values.concurrency);
  const timings = [];
  let failures = 0;
  let next = 0;
  async function worker() {
    while (next < total) {
      const index = next++;
      const params = new URLSearchParams({ q: `${pick(WORDS, index * 7)} ${pick(WORDS, index * 3).slice(0, 4)}` });
      if (index % 3 === 0) params.set("area", pick(AREAS, index));
      if (index % 5 === 0) params.set("page", "2");
      const started = performance.now();
      const response = await fetch(new URL(`/search?${params}`, values.url));
      await response.arrayBuffer();
      timings.push(performance.now() - started);
      if (!response.ok) failures++;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  timings.sort((a, b) => a - b);
  const percentile = (p) =>
    Math.round(timings[Math.min(timings.length - 1, Math.ceil((p / 100) * timings.length) - 1)]);
  const p95 = percentile(95);
  console.log(`${total} searches, ${concurrency} at a time, ${failures} failed`);
  console.log(
    `p50 ${percentile(50)} ms, p95 ${p95} ms, max ${Math.round(timings.at(-1))} ms (target p95 ≤ ${TARGET_P95_MS} ms)`,
  );
  if (failures || p95 > TARGET_P95_MS) process.exit(1);
}

if (command === "seed") executeSql(seedTarget(), seedSql(Number(values.count)));
else if (command === "remove") executeSql(seedTarget(), REMOVE_SQL);
else if (command === "run") await run();
else fail("Use: seed | run | remove (see the top of this file).");
