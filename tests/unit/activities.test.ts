import { describe, expect, it } from "vitest";
import { type Activity, activityProblems, completionProgress, forKind, readActivities } from "~/lib/activities";
import type { Segment } from "~/lib/segment-rules";

const SEGMENT = "6f1c2a7e-1111-4a5b-8c9d-000000000001";
const OTHER_SEGMENT = "6f1c2a7e-1111-4a5b-8c9d-000000000002";
const id = (n: number) => `0b7c8d9e-2222-4a5b-8c9d-${String(n).padStart(12, "0")}`;

const segment = (segmentId: string): Segment => ({
  id: segmentId,
  startMs: 0,
  endMs: 2_000,
  speaker: "",
  fijian: "Bula vinaka",
  english: "Hello",
  overlapIntended: false,
  draft: false,
  retimed: false,
  tokens: [],
});

const activity = (change: Partial<Activity> = {}): Activity => ({
  id: id(1),
  kind: "comprehension",
  segmentId: null,
  prompt: "What does Mere ask for?",
  options: [
    { id: id(11), text: "Fish", correct: true },
    { id: id(12), text: "Taro", correct: false },
  ],
  modelResponse: "",
  feedback: "She asks for ika, fish.",
  pronunciation: "",
  required: true,
  textAlternative: "Read the transcript, then choose what Mere asks for.",
  ...change,
});

const listenRepeat = (change: Partial<Activity> = {}) =>
  activity({
    id: id(2),
    kind: "listen-repeat",
    segmentId: SEGMENT,
    prompt: "Listen, then say it aloud.",
    options: [],
    modelResponse: "Bula vinaka",
    feedback: "Stress the first syllable of vinaka.",
    pronunciation: "BOO-la vee-NAH-ka",
    textAlternative: "Read “Bula vinaka” and write it out.",
    ...change,
  });

const segments = [segment(SEGMENT), segment(OTHER_SEGMENT)];
const messages = (items: Activity[], from = segments) =>
  activityProblems(items, from).map((problem) => problem.message);

describe("checking Activities", () => {
  it("accepts each kind when it has what that kind needs", () => {
    expect(
      activityProblems(
        [
          activity(),
          listenRepeat(),
          activity({ id: id(3), kind: "discrimination", segmentId: SEGMENT, prompt: "Which word did you hear?" }),
          activity({ id: id(4), kind: "next-line", options: [], modelResponse: "Vinaka, au lako mai Suva." }),
          activity({ id: id(5), kind: "next-line" }),
          activity({
            id: id(6),
            kind: "real-world",
            options: [],
            feedback: "",
            required: false,
            prompt: "Greet someone in Fijian this week.",
          }),
        ],
        segments,
      ),
    ).toEqual([]);
  });

  it("needs a prompt, feedback and an accessible text alternative, naming the Activity and field", () => {
    expect(activityProblems([activity({ prompt: " ", feedback: "", textAlternative: "" })], segments)).toEqual([
      { activityId: id(1), field: "prompt", message: "Activity 1 needs a prompt.", revalidate: false },
      {
        activityId: id(1),
        field: "feedback",
        message: "Activity 1 needs feedback for after the learner answers.",
        revalidate: false,
      },
      {
        activityId: id(1),
        field: "textAlternative",
        message: "Activity 1 needs a text alternative for learners who can't use the audio.",
        revalidate: false,
      },
    ]);
  });

  it("needs choices with at least one correct answer for multiple choice and listening discrimination", () => {
    expect(messages([activity({ options: [{ id: id(11), text: "Fish", correct: true }] })])).toEqual([
      "Activity 1 needs at least two choices.",
    ]);
    expect(
      messages([
        activity({
          kind: "discrimination",
          options: [
            { id: id(11), text: "Fish", correct: false },
            { id: id(12), text: " ", correct: false },
          ],
        }),
      ]),
    ).toEqual(["Activity 1 has an empty choice. Write it or remove it.", "Activity 1 needs a correct choice."]);
  });

  it("needs choices or a model response for what would you say next", () => {
    expect(messages([activity({ kind: "next-line", options: [], modelResponse: "" })])).toEqual([
      "Activity 1 needs choices or a model response.",
    ]);
  });

  it("needs the Segment and the words to repeat for listen and repeat", () => {
    expect(messages([listenRepeat({ segmentId: null, modelResponse: "" })])).toEqual([
      "Activity 1 needs the Segment to listen to and repeat.",
      "Activity 1 needs the words to repeat.",
    ]);
  });

  it("never lets a real-world prompt be required", () => {
    expect(
      activityProblems([activity({ kind: "real-world", options: [], feedback: "", required: true })], segments),
    ).toEqual([
      {
        activityId: id(1),
        field: "required",
        message: "Activity 1 is a real-world prompt, which can never be required.",
        revalidate: false,
      },
    ]);
  });

  it("keeps an Activity whose Segment was removed, flagged to link again", () => {
    expect(activityProblems([listenRepeat()], [segment(OTHER_SEGMENT)])).toEqual([
      {
        activityId: id(2),
        field: "segmentId",
        message: "Activity 1's Segment was removed. Link it to another Segment or the whole clip.",
        revalidate: true,
      },
    ]);
  });

  it("refuses more choices than a learner can weigh up", () => {
    const options = Array.from({ length: 7 }, (_, n) => ({ id: id(20 + n), text: `Choice ${n}`, correct: n === 0 }));
    expect(messages([activity({ options })])).toEqual(["Activity 1 can have at most 6 choices."]);
  });
});

describe("changing an Activity's kind", () => {
  it("drops what the new kind doesn't use, so nothing hidden is saved or reviewed", () => {
    const changed = forKind(listenRepeat(), "real-world");
    expect(changed).toMatchObject({ kind: "real-world", pronunciation: "", required: false, options: [] });
    expect(forKind(activity(), "listen-repeat")).toMatchObject({ options: [], pronunciation: "" });
    expect(forKind(activity(), "discrimination").options).toHaveLength(2);
  });
});

describe("reading Activities the editor sent", () => {
  it("reads each Activity and keeps its ID, trimming text and shaping it to its kind", () => {
    const sent = [
      { ...activity(), prompt: "  What does Mere ask for?  " },
      { ...listenRepeat(), options: [{ id: id(30), text: "stray", correct: true }] },
      { ...activity({ id: id(3), kind: "real-world", options: [], required: true }), pronunciation: "x" },
    ];
    const read = readActivities(JSON.stringify(sent));
    expect(read).toEqual({
      ok: true,
      items: [
        activity(),
        listenRepeat(),
        activity({ id: id(3), kind: "real-world", options: [], required: true, pronunciation: "" }),
      ],
    });
  });

  it("refuses an unknown kind, a repeated ID or a choice without an ID", () => {
    expect(readActivities(JSON.stringify([{ ...activity(), kind: "quiz" }]))).toMatchObject({ ok: false });
    expect(readActivities(JSON.stringify([activity(), activity()]))).toMatchObject({
      ok: false,
      error: "The Activities couldn't be read (number 2). Reload the editor and try again.",
    });
    expect(
      readActivities(JSON.stringify([activity({ options: [{ id: "x", text: "Fish", correct: true }] })])),
    ).toMatchObject({ ok: false });
    expect(readActivities("not json")).toMatchObject({ ok: false });
    expect(readActivities("")).toEqual({ ok: true, items: [] });
  });
});

describe("the Completion Rule", () => {
  const items = [activity(), listenRepeat(), activity({ id: id(3), required: false })];

  it("is met once every required Activity is attempted and its feedback viewed", () => {
    expect(
      completionProgress(items, {
        [id(1)]: { attempted: true, feedbackViewed: true },
        [id(2)]: { attempted: true, feedbackViewed: true },
      }),
    ).toEqual({ required: 2, done: 2, complete: true });
  });

  it("isn't met by attempting without viewing the feedback, or by optional Activities", () => {
    expect(
      completionProgress(items, {
        [id(1)]: { attempted: true, feedbackViewed: true },
        [id(2)]: { attempted: true, feedbackViewed: false },
        [id(3)]: { attempted: true, feedbackViewed: true },
      }),
    ).toEqual({ required: 2, done: 1, complete: false });
  });

  it("counts the accessible text route the same as the standard one", () => {
    expect(
      completionProgress([listenRepeat()], { [id(2)]: { attempted: true, feedbackViewed: true, viaText: true } }),
    ).toEqual({ required: 1, done: 1, complete: true });
  });

  it("is never met by watching alone: with nothing required, it can't be met", () => {
    expect(completionProgress([], {})).toEqual({ required: 0, done: 0, complete: false });
    expect(
      completionProgress([activity({ required: false })], { [id(1)]: { attempted: true, feedbackViewed: true } }),
    ).toEqual({ required: 0, done: 0, complete: false });
  });

  it("ignores a real-world prompt even if it arrived marked required", () => {
    expect(
      completionProgress([activity(), activity({ id: id(4), kind: "real-world", options: [], required: true })], {
        [id(1)]: { attempted: true, feedbackViewed: true },
      }),
    ).toEqual({ required: 1, done: 1, complete: true });
  });
});
