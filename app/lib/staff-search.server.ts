import { listArticles } from "./articles.server";
import { listContributors } from "./contributors.server";
import type { Database } from "./db.server";
import { layersFor } from "./learning-layers.server";
import { listMedia } from "./media.server";
import { type Actor, can } from "./permissions";
import { listProviders } from "./providers.server";
import { PUBLICATION_NAMES, type PublicationState } from "./review-names";
import { matchesQuery } from "./staff-search";
import { MEDIA_STATUS_NAMES } from "./upload-rules";

/** The most results shown for one kind; the page says when there are more. */
export const PER_KIND = 15;

/** `state` is the item's publication or processing state; null for a kind with none, such as a Contributor. */
export type SearchResult = { id: string; title: string; detail: string; state: string | null; href: string };
export type SearchGroup = { kind: string; results: SearchResult[]; more: number };

/**
 * Whether a person has anything to search: the same checks as the lists the results come from, so a
 * person is offered the search box exactly when at least one list is theirs to open.
 */
export function canSearch(actor: Actor) {
  return (
    can(actor, { action: "content.edit" }) ||
    can(actor, { action: "media.upload" }) ||
    can(actor, { action: "rights.manage" }) ||
    actor.roles.some((role) => role.role === "educator")
  );
}

function group<T extends { id: string }>(
  kind: string,
  rows: T[],
  query: string,
  fields: (row: T) => string[],
  result: (row: T) => Omit<SearchResult, "id">,
): SearchGroup | null {
  const found = rows.filter((row) => matchesQuery({ id: row.id, fields: fields(row) }, query));
  if (found.length === 0) return null;
  return {
    kind,
    results: found.slice(0, PER_KIND).map((row) => ({ id: row.id, ...result(row) })),
    more: Math.max(0, found.length - PER_KIND),
  };
}

/**
 * Staff search (BO-05). Each kind is read through the same function and the same permission as the
 * list page for it, so a person can only find what they could open from the lists. Cases, learner
 * records and anything else without such a list are never searched, and nothing here records the
 * query: not the audit log, not analytics, not the logs.
 */
export async function staffSearch(db: Database, actor: Actor, query: string): Promise<SearchGroup[]> {
  if (!query) return [];
  const editsContent = can(actor, { action: "content.edit" });
  const [articles, layers, media, contributors, providers] = await Promise.all([
    editsContent ? listArticles(db) : [],
    layersFor(db, actor),
    can(actor, { action: "media.upload" }) ? listMedia(db) : [],
    can(actor, { action: "rights.manage" }) ? listContributors(db) : [],
    editsContent ? listProviders(db) : [],
  ]);
  const state = (value: string) => PUBLICATION_NAMES[value as PublicationState] ?? value;

  return [
    group(
      "Content Items",
      articles,
      query,
      (row) => [row.title, row.slug],
      (row) => ({
        title: row.title,
        detail: row.typeName,
        state: state(row.publicationState),
        href: `/admin/articles/${row.id}`,
      }),
    ),
    group(
      "Learning Layers",
      layers,
      query,
      (row) => [row.title],
      (row) => ({
        title: row.title,
        detail: "Learning Layer",
        state: state(row.publicationState),
        href: `/admin/learning-layers/${row.id}`,
      }),
    ),
    group(
      "Media files",
      media,
      query,
      (row) => [row.name],
      (row) => ({
        title: row.name,
        detail: "Media file",
        state: MEDIA_STATUS_NAMES[row.status] ?? row.status,
        href: `/admin/media#asset-${row.id}`,
      }),
    ),
    group(
      "Contributors",
      contributors,
      query,
      (row) => [row.name],
      (row) => ({
        title: row.name,
        detail: "Contributor",
        state: null,
        href: `/admin/contributors#contributor-${row.id}`,
      }),
    ),
    group(
      "Providers",
      providers,
      query,
      (row) => [row.name, row.slug],
      (row) => ({
        title: row.name,
        detail: "Provider",
        state: row.listed ? "Listed on the public site" : "Not listed",
        href: `/admin/providers/${row.id}`,
      }),
    ),
  ].filter((entry): entry is SearchGroup => entry !== null);
}
