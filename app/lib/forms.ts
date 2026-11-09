/**
 * The public forms (docs/phase-1a-defaults.md §4, simplified by ADR-0015). Each takes its own few
 * fields and the person's agreement to the privacy notice in force. What arrives is stored as a
 * Submission, never published, and emailed to whoever handles that form. No form takes files.
 */

export type FormField = { name: string; label: string; long?: boolean; optional?: boolean; hint?: string };

/** Who reads what a form sends: the team, the safeguarding lead, or the privacy contact. */
export type Handler = "team" | "safeguarding" | "privacy";

export type FormSpec = {
  title: string;
  intro: string;
  handler: Handler;
  /** Whether the person must give an address to reply to; a report can be anonymous. */
  needsEmail: boolean;
  fields: FormField[];
  done: string;
};

const message: FormField = { name: "message", label: "Your message", long: true };

export const FORMS = {
  enquiry: {
    title: "Send us a message",
    intro: "Ask a question, tell us about a mistake, or suggest something. Someone from the team reads every message.",
    handler: "team",
    needsEmail: true,
    fields: [message],
    done: "Thank you. Your message has reached the team, and we'll reply by email.",
  },
  contribute: {
    title: "Offer a story, recording or piece of work",
    intro: "Tell us what you'd like to share. Don't send any files yet: if it's right for NAISEMA, we'll write to you.",
    handler: "team",
    needsEmail: true,
    fields: [{ name: "message", label: "What you'd like to share", long: true }],
    done: "Thank you. We'll read your offer and write to you.",
  },
  teach: {
    title: "Offer to teach",
    intro: "Tell us about your teaching and what you'd like to do. We don't need certificates or references now.",
    handler: "team",
    needsEmail: true,
    fields: [
      { name: "languages", label: "Languages and varieties you teach" },
      { name: "message", label: "Your experience, and what you'd like to do", long: true },
    ],
    done: "Thank you. We'll be in touch when teaching is being planned.",
  },
  consultation: {
    title: "Take part in a consultation",
    intro: "NAISEMA asks Fijians at home and abroad what it should do next. Tell us you'd like to be asked, and how.",
    handler: "team",
    needsEmail: true,
    fields: [{ name: "message", label: "How you'd like to take part", long: true, optional: true }],
    done: "Thank you. We'll ask you when the next consultation opens.",
  },
  report: {
    title: "Report a concern",
    intro:
      "Tell us about something on NAISEMA that is harmful, wrong, or used without permission. Our safeguarding lead reads every report. You can report without giving your name or address, but then we can't tell you what we did.",
    handler: "safeguarding",
    needsEmail: false,
    fields: [
      { name: "address", label: "Where it is on NAISEMA (its address or title)" },
      { name: "message", label: "What the concern is", long: true },
    ],
    done: "Thank you. Our safeguarding lead has your report.",
  },
  "privacy-request": {
    title: "Ask about your information",
    intro: "Ask to see, correct or delete what NAISEMA holds about you. Our privacy contact replies within 30 days.",
    handler: "privacy",
    needsEmail: true,
    fields: [{ name: "message", label: "What you'd like us to do", long: true }],
    done: "Thank you. Our privacy contact will reply by email within 30 days.",
  },
  "suggest-word": {
    title: "Suggest a Fijian word",
    intro: "Share a Fijian word or phrase and what it means in English. Our team checks every suggestion.",
    handler: "team",
    needsEmail: false,
    fields: [
      { name: "word", label: "The Fijian word or phrase" },
      { name: "meaning", label: "What it means in English", long: true },
    ],
    done: "Thank you. Our team will check your suggestion.",
  },
  "correct-word": {
    title: "Correct a dictionary entry",
    intro: "Found a mistake in a Vosa entry? Tell us the word and what it should say.",
    handler: "team",
    needsEmail: false,
    fields: [
      { name: "word", label: "The word" },
      { name: "message", label: "What it should say", long: true },
    ],
    done: "Thank you. Our team will check your correction.",
  },
  "suggest-translation": {
    title: "Propose a Fijian expression",
    intro:
      "How would you say an idea in Fijian? Share your wording and why it fits. None becomes an approved term automatically.",
    handler: "team",
    needsEmail: false,
    fields: [
      { name: "idea", label: "The idea" },
      { name: "message", label: "Your Fijian wording, and why it fits", long: true },
    ],
    done: "Thank you. Your proposal will be discussed and reviewed.",
  },
} as const satisfies Record<string, FormSpec>;

export type FormKey = keyof typeof FORMS;
export const isFormKey = (value: string): value is FormKey => Object.hasOwn(FORMS, value);

/**
 * The privacy notice every form shows, and its version, stored on each Submission so the wording a
 * person agreed to can be recovered. A new wording needs a new version.
 */
export const NOTICE = {
  version: "2026-11-v1",
  wording:
    "NAISEMA keeps what you send, and your name and email address if you give them, to reply to you and act on it. Only the people who handle this form can read it. It is stored by Cloudflare, which may process it outside Australia and Fiji. We keep it for 12 months after we last reply, then delete it. You can ask to see or delete it at any time.",
} as const;

export const FIELD_LIMITS = { short: 300, long: 5000, name: 120, email: 254 } as const;

export type FormValues = Record<string, string>;
export type FormErrors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What a form sent, checked: the values to keep, or each problem by field. */
export function readForm(
  spec: FormSpec,
  input: FormValues,
): { ok: true; values: FormValues } | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {};
  const values: FormValues = {};
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim();
  if (spec.needsEmail && !name) errors.name = "Enter your name.";
  if (spec.needsEmail && !email) errors.email = "Enter your email address, so we can reply.";
  if (email && !EMAIL.test(email)) errors.email = "Enter an email address like name@example.com.";
  if (name.length > FIELD_LIMITS.name) errors.name = `Your name can be at most ${FIELD_LIMITS.name} characters.`;
  for (const field of spec.fields) {
    const value = (input[field.name] ?? "").trim();
    const limit = field.long ? FIELD_LIMITS.long : FIELD_LIMITS.short;
    if (!value && !field.optional) errors[field.name] = `Fill in "${field.label}".`;
    else if (value.length > limit) errors[field.name] = `This can be at most ${limit} characters.`;
    if (value) values[field.name] = value;
  }
  if (input.notice !== NOTICE.version) errors.notice = "Tick the box to say you've read how we keep what you send.";
  if (Object.keys(errors).length) return { ok: false, errors };
  if (name) values.name = name;
  if (email) values.email = email.toLowerCase();
  return { ok: true, values };
}
