/**
 * What the public forms collect (docs/phase-1a-defaults.md §4; CONTEXT.md, Submission and Consent
 * Record). Every form takes a name and an email address to reply to, its own few fields, and the
 * person's consents, one per purpose. No form takes files: if an editor wants material from a
 * contribution proposal they send a single-use upload link afterwards.
 */

export const SUBMISSION_TYPES = {
  enquiry: {
    name: "Enquiry",
    path: "enquiry",
    title: "Send us a message",
    intro: "Ask a question, tell us about a mistake, or suggest something. An editor reads every message.",
  },
  contribution: {
    name: "Contribution proposal",
    path: "contribute",
    title: "Offer a story, recording or piece of work",
    intro:
      "Tell us what you'd like to share. Don't send any files yet: if it's right for Na iSema, an editor will email you a private link to upload it.",
  },
  educator_interest: {
    name: "Educator interest",
    path: "teach",
    title: "Offer to teach",
    intro:
      "Tell us about your teaching and what you'd like to do. We don't need any certificates or references now; we'll ask for those only once teaching is planned.",
  },
  consultation_interest: {
    name: "Consultation interest",
    path: "consultation",
    title: "Take part in a consultation",
    intro: "Na iSema asks Fijians at home and abroad what it should do next. Tell us you'd like to be asked, and how.",
  },
} as const;
export type SubmissionType = keyof typeof SUBMISSION_TYPES;

export const isSubmissionType = (value: string): value is SubmissionType => Object.hasOwn(SUBMISSION_TYPES, value);

/** Where a Submission has got to in the staff queue. */
export const SUBMISSION_STATUSES = {
  new: "New",
  in_progress: "Being worked on",
  closed: "Closed",
} as const;
export type SubmissionStatus = keyof typeof SUBMISSION_STATUSES;

/** Only a contribution proposal can be sent an upload link: the other forms never collect files. */
export const takesUploads = (type: SubmissionType) => type === "contribution";

/** How long an upload link works (docs/decision-log.md). */
export const UPLOAD_LINK_DAYS = 7;

/** The form at /forms/{path}. */
export const submissionTypeAt = (path: string) =>
  (Object.keys(SUBMISSION_TYPES) as SubmissionType[]).find((type) => SUBMISSION_TYPES[type].path === path) ?? null;

/** The educator categories of EDU-01 (docs/decision-log.md, educator interest). */
export const EDUCATOR_CATEGORIES = {
  first_language: "First-language or fluent speaker",
  qualified_teacher: "Qualified language teacher",
  community_educator: "Community, church or cultural educator",
  researcher: "Linguist or researcher",
  other: "Something else",
} as const;
export type EducatorCategory = keyof typeof EDUCATOR_CATEGORIES;

/** How someone would take part in a consultation (GOV-02). */
export const CONSULTATION_WAYS = {
  survey: "An online survey",
  interview: "A conversation with one of us",
  group: "A group discussion",
} as const;
export type ConsultationWay = keyof typeof CONSULTATION_WAYS;

/**
 * What a person can consent to. Each has its own notice (its wording, versioned and stored as
 * content) and its own Consent Record.
 */
export const CONSENT_PURPOSES = {
  reply: "Storing what you send and using it to reply to you",
  consultation: "Being contacted about Na iSema consultations",
  newsletter: "Receiving the Na iSema newsletter",
} as const;
export type ConsentPurpose = keyof typeof CONSENT_PURPOSES;

/** What a person ticks to agree, in their own voice. */
export const CONSENT_PROMPTS: Record<ConsentPurpose, string> = {
  reply: "Na iSema may keep what I send and use it to reply to me",
  consultation: "Na iSema may contact me about its consultations",
  newsletter: "Send me the Na iSema newsletter",
};

export const isConsentPurpose = (value: string): value is ConsentPurpose => Object.hasOwn(CONSENT_PURPOSES, value);

/** The consents each form asks for: those it needs, and one the person may add. */
export const FORM_CONSENTS: Record<
  SubmissionType | "newsletter",
  { required: ConsentPurpose[]; optional: ConsentPurpose[] }
> = {
  enquiry: { required: ["reply"], optional: ["newsletter"] },
  contribution: { required: ["reply"], optional: ["newsletter"] },
  educator_interest: { required: ["reply"], optional: ["newsletter"] },
  consultation_interest: { required: ["reply", "consultation"], optional: ["newsletter"] },
  newsletter: { required: ["newsletter"], optional: [] },
};

export const SUBMISSION_LIMITS = { name: 100, email: 254, short: 200, text: 5000, languages: 10 } as const;

/** A Submission's own answers, by field name; a list for a field with several. */
export type SubmissionFields = Record<string, string | string[]>;

/** A consent given on the form, with the notice version the person was shown. */
export type GivenConsent = { purpose: ConsentPurpose; noticeId: string };

export type SubmissionInput = {
  type: SubmissionType;
  name: string;
  email: string;
  fields: SubmissionFields;
  consents: GivenConsent[];
};

/** What the form gives back on a refusal: everything typed, so nothing has to be typed again. */
export type FormValues = Record<string, string | string[]>;

export type SubmissionFieldsResult =
  | { ok: true; submission: SubmissionInput }
  | { ok: false; errors: Record<string, string>; values: FormValues };

/** Fields that can hold several answers. */
const LIST_FIELDS = new Set(["consent", "ways"]);

/** Everything typed on a form, to give back with it, but never its Turnstile token. */
export function formValues(form: FormData): FormValues {
  const values: FormValues = {};
  for (const name of new Set(form.keys())) {
    if (name === "cf-turnstile-response" || name === "formKey" || name.startsWith("notice-")) continue;
    values[name] = LIST_FIELDS.has(name) ? form.getAll(name).map(String) : String(form.get(name) ?? "");
  }
  return values;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An email address as typed, or why it can't be used. */
export function emailProblem(email: string) {
  if (!email) return "Enter your email address, so we can reply.";
  if (email.length > SUBMISSION_LIMITS.email || !EMAIL.test(email)) {
    return "Enter your email address as name@example.com.";
  }
  return null;
}

/**
 * Reads the consents ticked on a form. Each ticked purpose carries the notice it was shown with
 * (`notice-{purpose}`); a purpose the form needs and isn't ticked is an error.
 */
export function readConsents(form: FormData, formName: SubmissionType | "newsletter") {
  const { required, optional } = FORM_CONSENTS[formName];
  const ticked = new Set(form.getAll("consent").map(String));
  const errors: Record<string, string> = {};
  const consents: GivenConsent[] = [];
  for (const purpose of [...required, ...optional]) {
    if (!ticked.has(purpose)) {
      if (required.includes(purpose)) errors[`consent-${purpose}`] = "We can't take this without your agreement.";
      continue;
    }
    const noticeId = String(form.get(`notice-${purpose}`) ?? "").trim();
    if (!noticeId) errors[`consent-${purpose}`] = "Reload the page and try again.";
    else consents.push({ purpose, noticeId });
  }
  return { consents, errors };
}

/** Reads one public form. */
export function readSubmission(form: FormData, type: SubmissionType): SubmissionFieldsResult {
  const errors: Record<string, string> = {};
  const values: FormValues = {};
  const text = (name: string, limit: number, required: string | null) => {
    const value = String(form.get(name) ?? "")
      .replaceAll("\r\n", "\n")
      .trim();
    values[name] = value;
    if (!value && required) errors[name] = required;
    else if (value.length > limit) errors[name] = `This can be at most ${limit.toLocaleString("en")} characters.`;
    return value;
  };
  const choice = <T extends string>(name: string, options: Record<T, string>, required: string) => {
    const value = String(form.get(name) ?? "");
    values[name] = value;
    if (!Object.hasOwn(options, value)) errors[name] = required;
    return value as T;
  };
  const lines = (name: string, required: string | null) => {
    const list = text(name, SUBMISSION_LIMITS.text, required)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (list.length > SUBMISSION_LIMITS.languages) errors[name] = `List at most ${SUBMISSION_LIMITS.languages}.`;
    else if (list.some((line) => line.length > SUBMISSION_LIMITS.short)) {
      errors[name] = `Each line can be at most ${SUBMISSION_LIMITS.short} characters.`;
    }
    return list;
  };

  const name = text("name", SUBMISSION_LIMITS.name, "Enter your name.");
  const email = text("email", SUBMISSION_LIMITS.email, null);
  const emailError = emailProblem(email);
  if (emailError) errors.email = emailError;

  const fields: SubmissionFields = {};
  switch (type) {
    case "enquiry":
      fields.message = text("message", SUBMISSION_LIMITS.text, "Enter your message.");
      break;
    case "contribution":
      fields.description = text(
        "description",
        SUBMISSION_LIMITS.text,
        "Tell us what you'd like to share: what it is, who made it and what it's about.",
      );
      break;
    case "educator_interest":
      fields.category = choice("category", EDUCATOR_CATEGORIES, "Choose what best describes you.");
      fields.languages = lines("languages", "Enter the languages or varieties you would teach.");
      fields.experience = text("experience", SUBMISSION_LIMITS.text, "Tell us about your teaching so far.");
      fields.scope = text("scope", SUBMISSION_LIMITS.text, "Tell us what you'd like to teach, and to whom.");
      break;
    case "consultation_interest": {
      fields.languages = lines("languages", null);
      fields.connection = text("connection", SUBMISSION_LIMITS.short, null);
      const chosen = form.getAll("ways").map(String);
      values.ways = chosen;
      const ways = chosen.filter((way) => Object.hasOwn(CONSULTATION_WAYS, way));
      if (!ways.length || ways.length !== chosen.length) errors.ways = "Choose at least one way you'd take part.";
      fields.ways = ways;
      fields.topics = text("topics", SUBMISSION_LIMITS.text, null);
      break;
    }
  }

  const consent = readConsents(form, type);
  Object.assign(errors, consent.errors);
  values.consent = form.getAll("consent").map(String);

  if (Object.keys(errors).length) return { ok: false, errors, values };
  return { ok: true, submission: { type, name, email, fields, consents: consent.consents } };
}

/** A Submission's answers as labelled lines, for staff and for the confirmation email. */
export function submissionSummary(type: SubmissionType, fields: SubmissionFields): { label: string; text: string }[] {
  const value = (name: string) => fields[name] ?? "";
  const list = (name: string) => [value(name)].flat().filter(Boolean);
  switch (type) {
    case "enquiry":
      return [{ label: "Message", text: String(value("message")) }];
    case "contribution":
      return [{ label: "What you'd like to share", text: String(value("description")) }];
    case "educator_interest":
      return [
        {
          label: "Describes you",
          text: EDUCATOR_CATEGORIES[value("category") as EducatorCategory] ?? String(value("category")),
        },
        { label: "Languages and varieties", text: list("languages").join(", ") },
        { label: "Teaching so far", text: String(value("experience")) },
        { label: "What you'd like to teach", text: String(value("scope")) },
      ];
    case "consultation_interest":
      return [
        { label: "Languages and varieties", text: list("languages").join(", ") || "Not given" },
        { label: "Connection to Fiji", text: String(value("connection")) || "Not given" },
        {
          label: "Ways to take part",
          text: list("ways")
            .map((way) => CONSULTATION_WAYS[way as ConsultationWay] ?? way)
            .join(", "),
        },
        { label: "What you'd like to be asked about", text: String(value("topics")) || "Not given" },
      ];
  }
}
