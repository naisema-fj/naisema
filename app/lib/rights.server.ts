import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { contributor, mediaAsset, rightsRecord, rightsRecordContributor, user } from "~db/schema";
import { auditInsert, recordAudit } from "./audit.server";
import type { Database } from "./db.server";
import { quarantineFile } from "./media.server";
import { isCurrent, isPermittedUse, type PermittedUse, type RightsFacts } from "./rights-rules";
import { checkContent, checkDeclared, HEAD_BYTES, storedName, type UploadType } from "./upload-rules";

/** What a Rights Record covers. Only whole Content Items for now; media assets get their own later. */
export type RightsSubject = { type: "content_item"; id: string };

type RecordRow = typeof rightsRecord.$inferSelect;

export const toFacts = (row: RecordRow): RightsFacts => ({
  id: row.id,
  permittedUses: row.permittedUses,
  guardianPermission: row.guardianPermission,
  expiresAt: row.expiresAt,
  withdrawnAt: row.withdrawnAt,
});

/** The rules' view of every Rights Record on a subject, oldest first. */
export async function rightsFactsFor(db: Database, subject: RightsSubject): Promise<RightsFacts[]> {
  const rows = await db
    .select()
    .from(rightsRecord)
    .where(and(eq(rightsRecord.subjectType, subject.type), eq(rightsRecord.subjectId, subject.id)))
    .orderBy(asc(rightsRecord.createdAt));
  return rows.map(toFacts);
}

export type RightsStatus = "current" | "expired" | "withdrawn";

const statusOf = (record: RecordRow, now: Date): RightsStatus =>
  record.withdrawnAt ? "withdrawn" : isCurrent(toFacts(record), now) ? "current" : "expired";

/** Every Rights Record on a subject, newest first, with its contributors and whether it is current. */
export async function listRights(db: Database, subject: RightsSubject, now = new Date()) {
  const rows = await db
    .select({
      record: rightsRecord,
      recordedBy: user.email,
      evidenceStatus: mediaAsset.status,
      evidenceReason: mediaAsset.statusReason,
    })
    .from(rightsRecord)
    .leftJoin(user, eq(user.id, rightsRecord.createdBy))
    .leftJoin(mediaAsset, eq(mediaAsset.id, rightsRecord.evidenceAssetId))
    .where(and(eq(rightsRecord.subjectType, subject.type), eq(rightsRecord.subjectId, subject.id)))
    .orderBy(asc(rightsRecord.createdAt));
  const links = rows.length
    ? await db
        .select({ recordId: rightsRecordContributor.rightsRecordId, name: contributor.name })
        .from(rightsRecordContributor)
        .innerJoin(contributor, eq(contributor.id, rightsRecordContributor.contributorId))
        .where(
          inArray(
            rightsRecordContributor.rightsRecordId,
            rows.map(({ record }) => record.id),
          ),
        )
    : [];
  return rows.reverse().map(({ record, recordedBy, evidenceStatus, evidenceReason }) => ({
    id: record.id,
    rightsHolder: record.rightsHolder,
    permittedUses: record.permittedUses,
    guardianPermission: record.guardianPermission,
    evidenceName: record.evidenceName,
    // Evidence stored before the scan pipeline has no asset and counts as ready.
    evidenceStatus: evidenceStatus ?? "ready",
    evidenceReason: evidenceReason ?? null,
    expiresAt: record.expiresAt,
    withdrawnAt: record.withdrawnAt,
    withdrawalReason: record.withdrawalReason,
    createdAt: record.createdAt,
    recordedBy: recordedBy ?? "a former staff member",
    contributors: links.filter((link) => link.recordId === record.id).map((link) => link.name),
    status: statusOf(record, now),
  }));
}

export type RightsForm = {
  rightsHolder: string;
  permittedUses: PermittedUse[];
  guardianPermission: boolean;
  expiresAt: Date | null;
  contributorIds: string[];
  evidence: { bytes: Uint8Array; name: string; type: UploadType };
};

/** What was typed into the form, to show it again when the form is refused (the file can't be kept). */
export type RightsFormValues = {
  rightsHolder: string;
  permittedUses: string[];
  expiresOn: string;
  contributorIds: string[];
};

export type RightsFormResult =
  | { ok: true; rights: RightsForm }
  | { ok: false; errors: Record<string, string>; values: RightsFormValues };

/** Reads the Rights Record form, including the evidence file, which must be a PDF or image. */
export async function readRightsForm(db: Database, form: FormData, now = new Date()): Promise<RightsFormResult> {
  const errors: Record<string, string> = {};
  const rightsHolder = String(form.get("rightsHolder") ?? "").trim();
  if (!rightsHolder) errors.rightsHolder = "Enter who holds the rights.";
  else if (rightsHolder.length > 300) errors.rightsHolder = "The rights holder can be at most 300 characters.";

  const permittedUses: PermittedUse[] = form.getAll("use").map(String).filter(isPermittedUse);
  if (!permittedUses.length) errors.permittedUses = "Choose at least one Permitted Use.";

  let expiresAt: Date | null = null;
  const expiry = String(form.get("expiresOn") ?? "").trim();
  if (expiry) {
    // An expiry date means the permission ends at the start of that day (UTC).
    expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? new Date(`${expiry}T00:00:00Z`) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) errors.expiresOn = "Enter the expiry as a date.";
    else if (expiresAt <= now) errors.expiresOn = "That date has passed; this permission has already expired.";
  }

  const contributorIds = [...new Set(form.getAll("contributorId").map(String))];
  if (contributorIds.length) {
    const known = await db
      .select({ id: contributor.id })
      .from(contributor)
      .where(inArray(contributor.id, contributorIds));
    if (known.length !== contributorIds.length) errors.contributorIds = "One of those contributors no longer exists.";
  }

  const file = form.get("evidence");
  let evidence: RightsForm["evidence"] | null = null;
  if (!(file instanceof File) || file.size === 0) errors.evidence = "Attach the evidence of this permission.";
  else {
    const declared = checkDeclared(file, "evidence");
    if (!declared.ok) errors.evidence = declared.error;
    else {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const content = checkContent(declared.type, bytes.subarray(0, HEAD_BYTES));
      if (!content.ok) errors.evidence = content.error;
      else evidence = { bytes, name: storedName(file.name), type: declared.type };
    }
  }

  if (Object.keys(errors).length || !evidence) {
    return { ok: false, errors, values: { rightsHolder, permittedUses, expiresOn: expiry, contributorIds } };
  }
  return {
    ok: true,
    rights: {
      rightsHolder,
      permittedUses,
      guardianPermission: form.get("guardianPermission") === "on",
      expiresAt,
      contributorIds,
      evidence,
    },
  };
}

/**
 * Records a Rights Record with its evidence. The evidence goes into quarantine and is scanned like
 * every upload (ADR-0010); it can be downloaded once it passes. If the record then can't be
 * written, the quarantined file is refused so it never reaches the evidence bucket.
 */
export async function recordRights(
  env: Env,
  db: Database,
  recordedBy: string,
  subject: RightsSubject,
  rights: RightsForm,
): Promise<string> {
  const id = crypto.randomUUID();
  const evidence = await quarantineFile(env, db, recordedBy, rights.evidence, "evidence");
  try {
    await db.batch([
      db.insert(rightsRecord).values({
        id,
        subjectType: subject.type,
        subjectId: subject.id,
        rightsHolder: rights.rightsHolder,
        permittedUses: rights.permittedUses,
        guardianPermission: rights.guardianPermission,
        evidenceKey: evidence.destinationKey,
        evidenceName: rights.evidence.name,
        evidenceType: rights.evidence.type,
        evidenceAssetId: evidence.id,
        expiresAt: rights.expiresAt,
        createdBy: recordedBy,
        createdAt: new Date(),
      }),
      ...rights.contributorIds.map((contributorId) =>
        db.insert(rightsRecordContributor).values({ rightsRecordId: id, contributorId }),
      ),
      auditInsert(db, {
        actorId: recordedBy,
        action: "rights_record.recorded",
        objectType: "rights_record",
        objectId: id,
        details: {
          subjectType: subject.type,
          subjectId: subject.id,
          permittedUses: rights.permittedUses,
          guardianPermission: rights.guardianPermission,
          expiresAt: rights.expiresAt?.toISOString() ?? null,
        },
      }),
    ]);
  } catch (error) {
    // The evidence belongs to no record: refuse it wherever its scan has got to, including a copy
    // already passed to the evidence bucket. Never let a failed clean-up hide why the record wasn't written.
    const reason = "Its Rights Record wasn't saved.";
    await Promise.all([
      db
        .update(mediaAsset)
        .set({ status: "failed", statusReason: reason, scannedAt: new Date(), updatedAt: new Date() })
        .where(eq(mediaAsset.id, evidence.id)),
      env.EVIDENCE.delete(evidence.destinationKey),
      recordAudit(db, {
        actorId: recordedBy,
        action: "media_asset.failed",
        objectType: "media_asset",
        objectId: evidence.id,
        details: { reason },
      }),
    ]).catch(() => undefined);
    throw error;
  }
  return id;
}

/**
 * Withdraws a Rights Record. From this moment anything relying on it is ineligible; nothing needs
 * unpublishing, because eligibility is decided on every request (ADR-0007).
 */
export async function withdrawRights(
  db: Database,
  withdrawnBy: string,
  subject: RightsSubject,
  recordId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!reason) return { ok: false, error: "Say why the permission is withdrawn." };
  const record = await db.select().from(rightsRecord).where(eq(rightsRecord.id, recordId)).get();
  if (record?.subjectType !== subject.type || record.subjectId !== subject.id) {
    return { ok: false, error: "That Rights Record doesn't belong to this article." };
  }
  if (record.withdrawnAt) return { ok: false, error: "That Rights Record is already withdrawn." };
  const withdrawalReason = reason.slice(0, 1000);
  await db.batch([
    db
      .update(rightsRecord)
      .set({ withdrawnAt: new Date(), withdrawnBy, withdrawalReason })
      .where(and(eq(rightsRecord.id, recordId), isNull(rightsRecord.withdrawnAt))),
    auditInsert(db, {
      actorId: withdrawnBy,
      action: "rights_record.withdrawn",
      objectType: "rights_record",
      objectId: recordId,
      details: { reason: withdrawalReason },
    }),
  ]);
  return { ok: true };
}

/**
 * A Rights Record's evidence file, for an editor to download, once its scan has passed. The read
 * is audited.
 */
export async function readEvidence(env: Env, db: Database, readBy: string, recordId: string) {
  const record = await db.select().from(rightsRecord).where(eq(rightsRecord.id, recordId)).get();
  if (!record) return null;
  if (record.evidenceAssetId) {
    const asset = await db.select().from(mediaAsset).where(eq(mediaAsset.id, record.evidenceAssetId)).get();
    if (asset?.status !== "ready") {
      return {
        unavailable: asset?.statusReason ?? "This evidence is still being scanned for viruses. Try again shortly.",
      };
    }
  }
  const object = await env.EVIDENCE.get(record.evidenceKey);
  if (!object) return null;
  await recordAudit(db, {
    actorId: readBy,
    action: "rights_evidence.read",
    objectType: "rights_record",
    objectId: recordId,
  });
  return { object, name: record.evidenceName, type: record.evidenceType };
}
