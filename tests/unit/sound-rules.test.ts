import { describe, expect, it } from "vitest";
import {
  checkSoundInput,
  formatSeconds,
  type SoundApprovalFacts,
  type SoundWording,
  soundFingerprint,
  soundLabel,
  soundReview,
} from "~/lib/sound-rules";

const A: SoundWording = {
  letter: "A",
  display: "A a",
  group: "vowel",
  ipa: "a",
  englishComparison: "a in father",
  note: "An open vowel.",
  recording: "audio/A.mp3",
};

const approval = (fingerprint: string, day: string, by = "reviewer@naisema.test"): SoundApprovalFacts => ({
  fingerprint,
  reviewerEmail: by,
  variety: "standard-fijian",
  createdAt: new Date(`${day}T00:00:00Z`),
});

describe("a Sound's fingerprint", () => {
  it("is the same for the same wording and recording, and changes with any part of either", async () => {
    const base = await soundFingerprint(A);
    expect(await soundFingerprint({ ...A })).toBe(base);
    for (const change of [
      { ipa: "ɑ" },
      { englishComparison: "a in car" },
      { note: "An open vowel, jaw low." },
      { recording: "d1e1" },
      { group: "consonant" as const },
      { display: "A" },
    ]) {
      expect(await soundFingerprint({ ...A, ...change }), JSON.stringify(change)).not.toBe(base);
    }
  });

  it("cannot be matched by moving text from one part to the next", async () => {
    const one = await soundFingerprint({ ...A, ipa: "ab", englishComparison: "c" });
    const two = await soundFingerprint({ ...A, ipa: "a", englishComparison: "bc" });
    expect(one).not.toBe(two);
  });
});

describe("a Sound's review", () => {
  it("is a draft until an approval matches its wording as it stands", async () => {
    const now = await soundFingerprint(A);
    expect(soundReview(now, []).state).toBe("draft");
    expect(soundReview(now, [approval("some-other-wording", "2026-11-01")]).state).toBe("draft");
    const review = soundReview(now, [approval(now, "2026-11-02")]);
    expect(review).toMatchObject({ state: "reviewed", by: "reviewer@naisema.test", variety: "standard-fijian" });
  });

  it("is a draft again once the wording or the recording changes", async () => {
    const before = await soundFingerprint(A);
    const approvals = [approval(before, "2026-11-02")];
    expect(soundReview(before, approvals).state).toBe("reviewed");
    const edited = await soundFingerprint({ ...A, note: "A different note." });
    expect(soundReview(edited, approvals).state).toBe("draft");
    const rerecorded = await soundFingerprint({ ...A, recording: "a-new-recording" });
    expect(soundReview(rerecorded, approvals).state).toBe("draft");
  });

  it("counts an approval of wording that is back as it was, and shows the newest matching one", async () => {
    const now = await soundFingerprint(A);
    const review = soundReview(now, [
      approval(now, "2026-11-02", "first@naisema.test"),
      approval("changed", "2026-11-03"),
      approval(now, "2026-11-04", "second@naisema.test"),
    ]);
    expect(review).toMatchObject({ state: "reviewed", by: "second@naisema.test" });
  });

  it("is labelled in the Review Labels' words", async () => {
    const now = await soundFingerprint(A);
    expect(soundLabel(soundReview(now, [approval(now, "2026-11-02")]), "Fijian")).toBe(
      "Language reviewed · Fijian · 2 Nov 2026",
    );
    expect(soundLabel(soundReview(now, []), "Fijian")).toBe("Not reviewed yet");
  });
});

describe("a Sound's wording", () => {
  it("is trimmed, needs a note, and has limits", () => {
    expect(checkSoundInput({ ipa: " a ", englishComparison: " a in father ", note: " Open. " })).toEqual({
      ok: true,
      value: { ipa: "a", englishComparison: "a in father", note: "Open." },
    });
    expect(checkSoundInput({ ipa: "", englishComparison: "", note: "A label." }).ok).toBe(true);
    expect(checkSoundInput({ ipa: "a", englishComparison: "x", note: "  " }).ok).toBe(false);
    expect(checkSoundInput({ ipa: "a".repeat(41), englishComparison: "x", note: "n" }).ok).toBe(false);
    expect(checkSoundInput({ ipa: "a", englishComparison: "x".repeat(201), note: "n" }).ok).toBe(false);
    expect(checkSoundInput({ ipa: "a", englishComparison: "x", note: "n".repeat(601) }).ok).toBe(false);
  });

  it("shows a recording's length to a tenth of a second", () => {
    expect(formatSeconds(4490)).toBe("4.5s");
    expect(formatSeconds(null)).toBeNull();
  });
});
