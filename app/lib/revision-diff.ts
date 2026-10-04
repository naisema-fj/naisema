import type { ArticleBody, Block, Inline } from "./article-body";

/**
 * A body as plain lines, one per block, for comparing two Revisions. Links and image addresses
 * are spelled out so a changed address shows up as a changed line.
 */
export function bodyLines(body: ArticleBody): string[] {
  return body.content.flatMap((block) => blockLines(block));
}

function blockLines(block: Block): string[] {
  switch (block.type) {
    case "paragraph": {
      const text = inlineText(block.content);
      return text ? [text] : [];
    }
    case "heading":
      return [`Heading ${block.attrs.level}: ${inlineText(block.content)}`];
    case "bulletList":
    case "orderedList":
      return block.content.flatMap((item, index) => {
        const marker = block.type === "bulletList" ? "•" : `${(block.attrs?.start ?? 1) + index}.`;
        const [first = "", ...rest] = item.content.flatMap((child) => blockLines(child));
        return [`${marker} ${first}`, ...rest.map((line) => `  ${line}`)];
      });
    case "blockquote":
      return block.content.flatMap((child) => blockLines(child)).map((line) => `Quote: ${line}`);
    case "image":
      return [`Image: ${block.attrs.alt} [${block.attrs.src}]`];
    case "contentItem":
      return [`Embedded item: ${block.attrs.id}`];
    case "callout":
      return block.content.flatMap((child) => blockLines(child)).map((line) => `Callout: ${line}`);
  }
}

function inlineText(content: readonly Inline[] | undefined): string {
  return (content ?? [])
    .map((node) => {
      if (node.type === "hardBreak") return " / ";
      const link = node.marks?.find((mark) => mark.type === "link");
      return link ? `${node.text} [link: ${link.attrs.href}]` : node.text;
    })
    .join("");
}

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

/** A line-by-line diff (longest common subsequence), removals listed before additions. */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  // common[i][j] = length of the longest common subsequence of before[i..] and after[j..]
  const common = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      common[i][j] = before[i] === after[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      lines.push({ kind: "same", text: before[i] });
      i++;
      j++;
    } else if (common[i + 1][j] >= common[i][j + 1]) {
      lines.push({ kind: "removed", text: before[i++] });
    } else {
      lines.push({ kind: "added", text: after[j++] });
    }
  }
  while (i < before.length) lines.push({ kind: "removed", text: before[i++] });
  while (j < after.length) lines.push({ kind: "added", text: after[j++] });
  return lines;
}
