import { describe, expect, it } from "vitest";
import { readConsents, readSubmission, submissionSummary, submissionTypeAt } from "~/lib/submission-fields";

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const each of [value].flat()) data.append(name, each);
  }
  return data;
};

const person = { name: "Mere Vula", email: "mere@example.com", consent: "reply", "notice-reply": "notice-reply-1" };

describe("readSubmission", () => {
  it("reads an enquiry with the person's name, email and the notice they agreed under", () => {
    expect(readSubmission(form({ ...person, message: "  Bula! Is there a Lauan course?\r\n" }), "enquiry")).toEqual({
      ok: true,
      submission: {
        type: "enquiry",
        name: "Mere Vula",
        email: "mere@example.com",
        fields: { message: "Bula! Is there a Lauan course?" },
        consents: [{ purpose: "reply", noticeId: "notice-reply-1" }],
      },
    });
  });

  it("adds the newsletter consent only when it is ticked", () => {
    const result = readSubmission(
      form({
        ...person,
        consent: ["reply", "newsletter"],
        "notice-newsletter": "notice-newsletter-2",
        description: "A recording of my grandmother's meke.",
      }),
      "contribution",
    );

    expect(result).toMatchObject({
      ok: true,
      submission: {
        fields: { description: "A recording of my grandmother's meke." },
        consents: [
          { purpose: "reply", noticeId: "notice-reply-1" },
          { purpose: "newsletter", noticeId: "notice-newsletter-2" },
        ],
      },
    });
  });

  it("reads educator interest: the EDU-01 category, languages, experience and scope, and no evidence", () => {
    const result = readSubmission(
      form({
        ...person,
        category: "qualified_teacher",
        languages: "Standard Fijian\n\nLauan\n",
        experience: "Ten years at a Suva primary school.",
        scope: "Evening classes for adults in Brisbane.",
        certificate: "ignored",
      }),
      "educator_interest",
    );

    expect(result).toMatchObject({
      ok: true,
      submission: {
        fields: {
          category: "qualified_teacher",
          languages: ["Standard Fijian", "Lauan"],
          experience: "Ten years at a Suva primary school.",
          scope: "Evening classes for adults in Brisbane.",
        },
      },
    });
    if (result.ok) expect(result.submission.fields).not.toHaveProperty("certificate");
  });

  it("needs the consultation consent as well as the reply one for consultation interest", () => {
    const refused = readSubmission(form({ ...person, ways: "survey" }), "consultation_interest");
    const accepted = readSubmission(
      form({
        ...person,
        consent: ["reply", "consultation"],
        "notice-consultation": "notice-consultation-1",
        ways: ["survey", "group"],
      }),
      "consultation_interest",
    );

    expect(refused).toMatchObject({ ok: false, errors: { "consent-consultation": expect.any(String) } });
    expect(accepted).toMatchObject({
      ok: true,
      submission: { fields: { ways: ["survey", "group"], languages: [], connection: "", topics: "" } },
    });
  });

  it("refuses a form without the person's agreement, a usable email or the required answers, giving back what was typed", () => {
    const result = readSubmission(form({ name: "", email: "mere at example", message: "", consent: [] }), "enquiry");

    expect(result).toEqual({
      ok: false,
      errors: {
        name: expect.any(String),
        email: expect.stringContaining("name@example.com"),
        message: expect.any(String),
        "consent-reply": expect.any(String),
      },
      values: { name: "", email: "mere at example", message: "", consent: [] },
    });
  });

  it("refuses a made-up category or way of taking part, and answers that are too long", () => {
    expect(
      readSubmission(
        form({ ...person, category: "wizard", languages: "x", experience: "x", scope: "x" }),
        "educator_interest",
      ),
    ).toMatchObject({ ok: false, errors: { category: expect.any(String) } });
    expect(readSubmission(form({ ...person, ways: ["survey", "telepathy"] }), "consultation_interest")).toMatchObject({
      ok: false,
      errors: { ways: expect.any(String) },
    });
    expect(readSubmission(form({ ...person, message: "a".repeat(5001) }), "enquiry")).toMatchObject({
      ok: false,
      errors: { message: expect.stringContaining("5,000") },
    });
  });
});

describe("readConsents", () => {
  it("needs the notice a ticked purpose was shown with", () => {
    expect(readConsents(form({ consent: "newsletter" }), "newsletter")).toEqual({
      consents: [],
      errors: { "consent-newsletter": expect.any(String) },
    });
  });

  it("ignores purposes the form doesn't ask about", () => {
    expect(
      readConsents(form({ consent: ["newsletter", "consultation"], "notice-newsletter": "n1" }), "newsletter"),
    ).toEqual({ consents: [{ purpose: "newsletter", noticeId: "n1" }], errors: {} });
  });
});

describe("forms", () => {
  it("are found by their address", () => {
    expect(submissionTypeAt("teach")).toBe("educator_interest");
    expect(submissionTypeAt("enquiry")).toBe("enquiry");
    expect(submissionTypeAt("educator_interest")).toBeNull();
  });

  it("summarise their answers in words for staff and for the confirmation email", () => {
    expect(
      submissionSummary("educator_interest", {
        category: "qualified_teacher",
        languages: ["Standard Fijian", "Lauan"],
        experience: "Ten years",
        scope: "Adults",
      }),
    ).toEqual([
      { label: "Describes you", text: "Qualified language teacher" },
      { label: "Languages and varieties", text: "Standard Fijian, Lauan" },
      { label: "Teaching so far", text: "Ten years" },
      { label: "What you'd like to teach", text: "Adults" },
    ]);
  });
});
