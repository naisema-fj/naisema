import { checkContent, checkDeclared, HEAD_BYTES, storedName, type UploadType } from "./upload-rules";

/** An evidence file as a form sends it, checked against the evidence allowlist and its first bytes. */
export type EvidenceFile = { bytes: Uint8Array; name: string; type: UploadType };

/**
 * Reads an evidence file from a form field: a PDF or image of at most 10 MB whose first bytes
 * match its type (docs/phase-1a-defaults.md §1). It still goes through quarantine and the scan.
 */
export async function readEvidenceFile(
  value: FormDataEntryValue | null,
  missing: string,
): Promise<{ ok: true; file: EvidenceFile } | { ok: false; error: string }> {
  if (!(value instanceof File) || value.size === 0) return { ok: false, error: missing };
  const declared = checkDeclared(value, "evidence");
  if (!declared.ok) return { ok: false, error: declared.error };
  const bytes = new Uint8Array(await value.arrayBuffer());
  const content = checkContent(declared.type, bytes.subarray(0, HEAD_BYTES));
  if (!content.ok) return { ok: false, error: content.error };
  return { ok: true, file: { bytes, name: storedName(value.name), type: declared.type } };
}
