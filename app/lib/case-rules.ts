import type { CaseKind } from "./permissions";
import { emailProblem, type FormValues, type GivenConsent, normaliseEmail, readConsents } from "./submission-fields";

/**
 * Cases (CONTEXT.md; SAFE-01–03, DATA-03): a restricted record of a report, rights concern or data
 * request, which moves received → triaged → actioned → closed with one owner. A decision can be
 * appealed once, and the appeal is decided by someone other than whoever made the decision
 * (permissions.ts, case.decideAppeal). Pure rules and form readers; cases.server.ts stores them.
 */

export type { CaseKind };

export const CASE_KINDS: Record<CaseKind, string> = {
  report: "Report",
  rights_concern: "Rights concern",
  data_request: "Data request",
};

export const CASE_STATES = {
  received: "Received",
  triaged: "Triaged",
  actioned: "Actioned",
  appealed: "Appealed",
  closed: "Closed",
} as const;
export type CaseState = keyof typeof CASE_STATES;

export const SEVERITIES = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent: someone may be at risk",
} as const;
export type Severity = keyof typeof SEVERITIES;

/** What a visitor can report about an item (SAFE-01); a rights issue is a rights concern. */
export const REPORT_REASONS = {
  harm: "It could hurt or endanger someone",
  inaccuracy: "Something in it is wrong",
  rights: "It uses someone's work, words or image without permission",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** What a person can ask about the information Na iSema holds on them (DATA-03). */
export const DATA_REQUESTS = {
  access: "A copy of what Na iSema holds about me",
  deletion: "Delete what Na iSema holds about me",
  correction: "Correct something Na iSema holds about me",
  other: "Something else",
} as const;
export type DataRequestReason = keyof typeof DATA_REQUESTS;

/** How a report or rights concern ended, as the reporter is told it. */
export const CONTENT_OUTCOMES = {
  no_action: "We looked into it and decided no change was needed",
  content_changed: "The content has been changed",
  content_removed: "The content has been taken down",
  other: "We acted on it in another way",
} as const;

/** How a data request ended, as the person is told it. */
export const DATA_OUTCOMES = {
  data_provided: "We have sent you a copy of what we hold",
  data_deleted: "We have deleted what we hold about you",
  data_corrected: "We have corrected what we hold about you",
  refused: "We could not do what you asked",
  other: "We acted on it in another way",
} as const;

export type CaseOutcome = keyof typeof CONTENT_OUTCOMES | keyof typeof DATA_OUTCOMES;

export const outcomesFor = (kind: CaseKind): Record<string, string> =>
  kind === "data_request" ? DATA_OUTCOMES : CONTENT_OUTCOMES;

export const APPEAL_OUTCOMES = {
  upheld: "The decision stands",
  overturned: "The decision was changed",
} as const;
export type AppealOutcome = keyof typeof APPEAL_OUTCOMES;

/** Days after a decision in which it can be appealed (docs/decision-log.md). */
export const APPEAL_DAYS = 30;

export const CASE_LIMITS = { name: 100, text: 5000 } as const;

const MOVES: Record<CaseState, CaseState[]> = {
  received: ["triaged"],
  triaged: ["actioned"],
  actioned: ["closed", "appealed"],
  appealed: ["closed"],
  closed: ["appealed"],
};

/** Whether a Case may move from one state to another. */
export const canMove = (from: CaseState, to: CaseState) => MOVES[from].includes(to);

/** Whether a decision can still be appealed: once, within APPEAL_DAYS of it. */
export function appealOpen(found: { state: CaseState; decidedAt: Date | null; appealedAt: Date | null }, now: Date) {
  if (!found.decidedAt || found.appealedAt || !canMove(found.state, "appealed")) return false;
  return now.getTime() - found.decidedAt.getTime() <= APPEAL_DAYS * 86_400_000;
}

type Read<T, K extends string> = { ok: true } & Record<K, T>;
type Refused = { ok: false; errors: Record<string, string>; values: FormValues };

function fieldReader(form: FormData) {
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
  return { errors, values, text, choice };
}

export type CaseReport = {
  kind: "report" | "rights_concern";
  reason: ReportReason;
  details: string;
  contentItemId: string | null;
  name: string;
  /** Null for an anonymous report, which can't be told the outcome or appeal. */
  email: string | null;
  consents: GivenConsent[];
};

/** Reads the public report form. The item it is about comes from the link on the item's page. */
export function readReport(form: FormData): Read<CaseReport, "report"> | Refused {
  const { errors, values, text, choice } = fieldReader(form);
  const reason = choice("reason", REPORT_REASONS, "Choose what is wrong.");
  const details = text("details", CASE_LIMITS.text, "Tell us what is wrong, and where.");
  const contentItemId = text("item", 100, null);
  const name = text("name", CASE_LIMITS.name, null);
  const email = text("email", 254, null);
  values.consent = form.getAll("consent").map(String);
  let consents: GivenConsent[] = [];
  if (email) {
    const problem = emailProblem(email);
    if (problem) errors.email = problem;
    const read = readConsents(form, "report");
    Object.assign(errors, read.errors);
    consents = read.consents;
  }
  if (Object.keys(errors).length) return { ok: false, errors, values };
  return {
    ok: true,
    report: {
      kind: reason === "rights" ? "rights_concern" : "report",
      reason,
      details,
      contentItemId: contentItemId || null,
      name,
      email: email ? normaliseEmail(email) : null,
      consents,
    },
  };
}

export type CaseDataRequest = {
  kind: "data_request";
  reason: DataRequestReason;
  details: string;
  name: string;
  email: string;
  consents: GivenConsent[];
};

/** Reads the privacy route's form: a request to see, correct or delete what Na iSema holds. */
export function readDataRequest(form: FormData): Read<CaseDataRequest, "request"> | Refused {
  const { errors, values, text, choice } = fieldReader(form);
  const name = text("name", CASE_LIMITS.name, "Enter your name.");
  const email = text("email", 254, null);
  const problem = emailProblem(email);
  if (problem) errors.email = problem;
  const reason = choice("request", DATA_REQUESTS, "Choose what you'd like us to do.");
  const needsDetails = reason === "correction" || reason === "other";
  const details = text("details", CASE_LIMITS.text, needsDetails ? "Tell us what you'd like us to do." : null);
  const read = readConsents(form, "data_request");
  Object.assign(errors, read.errors);
  values.consent = form.getAll("consent").map(String);
  if (Object.keys(errors).length) return { ok: false, errors, values };
  return {
    ok: true,
    request: { kind: "data_request", reason, details, name, email: normaliseEmail(email), consents: read.consents },
  };
}

type StaffRead<T, K extends string> = (Read<T, K> & { ok: true }) | { ok: false; errors: Record<string, string> };

/** Triage: how serious the Case is and who owns it, one of those who can handle its kind. */
export function readTriage(
  form: FormData,
  handlerIds: string[],
): StaffRead<{ severity: Severity; ownerId: string }, "triage"> {
  const { errors, choice } = fieldReader(form);
  const severity = choice("severity", SEVERITIES, "Choose how serious it is.");
  const ownerId = String(form.get("ownerId") ?? "");
  if (!handlerIds.includes(ownerId)) errors.ownerId = "Choose who owns it: someone who handles this kind of Case.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, triage: { severity, ownerId } };
}

/** A decision: its outcome, what was done, and why. */
export function readDecision(
  form: FormData,
  kind: CaseKind,
): StaffRead<{ outcome: CaseOutcome; action: string; rationale: string }, "decision"> {
  const { errors, text, choice } = fieldReader(form);
  const outcome = choice("outcome", outcomesFor(kind), "Choose the outcome.") as CaseOutcome;
  const action = text("action", CASE_LIMITS.text, "Say what was done.");
  const rationale = text("rationale", CASE_LIMITS.text, "Say why.");
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, decision: { outcome, action, rationale } };
}

/** An appeal: the person's reasons for asking for the decision to be looked at again. */
export function readAppeal(form: FormData): { ok: true; reasons: string } | Refused {
  const { errors, values, text } = fieldReader(form);
  const reasons = text("reasons", CASE_LIMITS.text, "Tell us why the decision should be looked at again.");
  return Object.keys(errors).length ? { ok: false, errors, values } : { ok: true, reasons };
}

/** An appeal's decision: whether the original decision stands, and why. */
export function readAppealDecision(
  form: FormData,
): StaffRead<{ outcome: AppealOutcome; rationale: string }, "decision"> {
  const { errors, text, choice } = fieldReader(form);
  const outcome = choice("outcome", APPEAL_OUTCOMES, "Choose whether the decision stands.");
  const rationale = text("rationale", CASE_LIMITS.text, "Say why.");
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, decision: { outcome, rationale } };
}
