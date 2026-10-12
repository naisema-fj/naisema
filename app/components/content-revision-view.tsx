import type { ReactNode } from "react";
import type { ArticleSnapshot } from "~/lib/article-fields";
import { ArticleBodyView, type EmbeddedItem } from "./article-body-view";
import { RevisionTypeDetails } from "./revision-type-details";

/**
 * A Content Item Revision as its reviewers see it: title, summary, Topics, credit, sources, body
 * and what its kind adds (a Resource's file, an Episode's recording and transcript, a Video). The
 * staff revision page and a Review Link show it the same way, so a Knowledge Holder sees exactly
 * what the reviewers see.
 */
export function ContentRevisionView({
  snapshot,
  topics,
  embeds,
  fileName,
  sampleTitle,
  audioPath,
  player,
}: {
  snapshot: ArticleSnapshot;
  topics: string[];
  embeds: Record<string, EmbeddedItem>;
  fileName: string | null;
  sampleTitle: string | null;
  audioPath: string | null;
  player?: ReactNode | null;
}) {
  return (
    <article className="article-preview">
      <h1>{snapshot.title}</h1>
      <p className="summary">{snapshot.summary}</p>
      <dl>
        <dt>Topics</dt>
        <dd>{topics.join(", ")}</dd>
        <dt>Credit</dt>
        <dd>{snapshot.credit}</dd>
        {snapshot.sources && (
          <>
            <dt>Sources</dt>
            <dd className="sources">{snapshot.sources}</dd>
          </>
        )}
      </dl>
      <ArticleBodyView body={snapshot.body} embeds={embeds} />
      <RevisionTypeDetails
        snapshot={snapshot}
        fileName={fileName}
        sampleTitle={sampleTitle}
        audioPath={audioPath}
        player={player}
      />
    </article>
  );
}
