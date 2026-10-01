import { data, redirect } from "react-router";
import { listContributors } from "./contributors.server";
import type { Database } from "./db.server";
import {
  listRights,
  partValue,
  type RightsFormValues,
  type RightsSubject,
  readRightsForm,
  recordRights,
  withdrawRights,
} from "./rights.server";
import { RIGHTS_PART_NAMES, type RightsPart } from "./rights-rules";
import { readLimitedFormData, UploadTooLarge } from "./upload-limit.server";
import { EVIDENCE_MAX_BYTES } from "./upload-rules";

/** What a rights page's form sends back when nothing was saved. */
export type RightsActionData = {
  errors: Record<string, string>;
  values: RightsFormValues | null;
  withdraw: { recordId: string; error: string } | null;
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What a rights page shows: the subject's records, the parts a record may cover, the contributors. */
export async function rightsPageData(db: Database, subject: RightsSubject, parts: RightsPart[] = []) {
  return {
    parts: parts.map((part) => ({
      value: partValue(part),
      label: `${capitalise(RIGHTS_PART_NAMES[part.kind])}: ${part.name}`,
    })),
    records: await listRights(db, subject),
    contributors: await listContributors(db),
  };
}

/**
 * A rights page's form: records or withdraws a Rights Record on `subject`, then calls `changed` so
 * whatever the record decides is brought up to date, and returns to `page`.
 */
export async function rightsAction(
  env: Env,
  db: Database,
  actorId: string,
  request: Request,
  options: { subject: RightsSubject; parts?: RightsPart[]; page: string; changed: () => Promise<unknown> },
) {
  let form: FormData;
  try {
    // The allowance over the evidence limit covers the form's other fields.
    form = await readLimitedFormData(request, EVIDENCE_MAX_BYTES + 64 * 1024);
  } catch (error) {
    if (!(error instanceof UploadTooLarge)) throw error;
    const errors = { evidence: "Evidence files can be at most 10 MB." };
    return data<RightsActionData>({ errors, values: null, withdraw: null }, { status: 413 });
  }

  if (form.get("intent") === "withdraw") {
    const recordId = String(form.get("recordId") ?? "");
    const result = await withdrawRights(
      db,
      actorId,
      options.subject,
      recordId,
      String(form.get("reason") ?? "").trim(),
    );
    if (!result.ok) {
      return data<RightsActionData>(
        { errors: {}, values: null, withdraw: { recordId, error: result.error } },
        { status: 400 },
      );
    }
    // What relied on the record may have just become ineligible.
    await options.changed();
    throw redirect(`${options.page}?done=withdrawn`);
  }

  const result = await readRightsForm(db, form, options.parts ?? []);
  if (!result.ok) {
    return data<RightsActionData>({ errors: result.errors, values: result.values, withdraw: null }, { status: 400 });
  }
  await recordRights(env, db, actorId, options.subject, result.rights);
  // A new record can make what relies on it eligible again.
  await options.changed();
  throw redirect(`${options.page}?done=recorded`);
}
