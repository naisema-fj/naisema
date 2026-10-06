/**
 * Tokens (ADR-0011, docs/phase-1a-defaults.md §2): a Segment's Fijian text split into words, each
 * with an ID that survives edits. Re-tokenising after an edit matches the new words against the
 * old ones with a longest-common-subsequence diff, so words that are still there keep their IDs
 * and Annotations stay anchored to them; new or respelt words get new IDs. Spaces and punctuation
 * aren't tokens, and a hyphenated compound ("vale-ni-vuli") is one token per part, so a part can
 * be annotated on its own and the whole compound as a run of tokens. Shared by the editor in the
 * browser and the server.
 */

export type Token = { id: string; text: string };

/** A word: letters (with their accents and macrons) and digits, joined by apostrophes. */
const WORD = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;

/** Each word in a text with where it starts and ends, for showing tokens in place. */
export function tokenSpans(text: string) {
  return [...text.matchAll(WORD)].map((match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export const tokenTexts = (text: string) => tokenSpans(text).map((span) => span.text);

/**
 * The text of the words from the `start`th to the `end`th, as written between them (spaces,
 * hyphens, apostrophes), for showing what an Annotation covers.
 */
export function rangeText(text: string, start: number, end: number) {
  const spans = tokenSpans(text);
  return spans[start] && spans[end] ? text.slice(spans[start].start, spans[end].end) : "";
}

/** How two words are compared: the same word whatever its capitals or Unicode form. */
const key = (word: string) => word.normalize("NFC").toLowerCase();

/**
 * Tokens for a text, keeping the IDs of `previous` tokens whose words are still there, in the
 * same order. `newId` makes an ID for each new word. Diff once against the tokens from before an
 * edit, not after every keystroke: a half-typed word in between can match the wrong word.
 */
export function retokenise(previous: Token[], text: string, newId: () => string = () => crypto.randomUUID()): Token[] {
  const words = tokenTexts(text);
  const before = previous.map((token) => key(token.text));
  const after = words.map(key);
  // lengths[i][j]: the longest common subsequence of before[i..] and after[j..].
  const lengths = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i][j] =
        before[i] === after[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const tokens: Token[] = [];
  let i = 0;
  let j = 0;
  // Where the same word appears more than once, the match is made as late as it can be: a word
  // typed in front of the same word is the new one, and of two equal words the earlier is the one
  // deleted. Which copy an edit meant can't be told from the words alone.
  while (j < after.length) {
    if (i < before.length && lengths[i + 1][j] === lengths[i][j]) {
      i++;
    } else if (lengths[i][j + 1] === lengths[i][j]) {
      tokens.push({ id: newId(), text: words[j] });
      j++;
    } else {
      tokens.push({ id: previous[i].id, text: words[j] });
      i++;
      j++;
    }
  }
  return tokens;
}

/** Whether tokens are exactly a text's words, in order, with no ID used twice. */
export function sameTokens(tokens: Token[], text: string) {
  const words = tokenTexts(text);
  return (
    tokens.length === words.length &&
    tokens.every((token, index) => token.text === words[index]) &&
    new Set(tokens.map((token) => token.id)).size === tokens.length
  );
}
