import type { Browser } from "./staff";

export const pdfEvidence = () =>
  new File([new TextEncoder().encode("%PDF-1.7\n% signed permission\n")], "permission.pdf", {
    type: "application/pdf",
  });

/** Records a Rights Record on an article through the rights page, as an editor would. */
export function recordRights(
  browser: Browser,
  articleId: string,
  fields: {
    uses?: string[];
    guardianPermission?: boolean;
    expiresOn?: string;
    evidence?: File;
    rightsHolder?: string;
    part?: { kind: string; name: string };
  } = {},
) {
  const form = new FormData();
  form.set("intent", "record");
  if (fields.part) {
    form.set("partKind", fields.part.kind);
    form.set("partName", fields.part.name);
  }
  form.set("rightsHolder", fields.rightsHolder ?? "Sera Vula");
  for (const use of fields.uses ?? ["publish"]) form.append("use", use);
  if (fields.guardianPermission) form.set("guardianPermission", "on");
  if (fields.expiresOn) form.set("expiresOn", fields.expiresOn);
  form.set("evidence", fields.evidence ?? pdfEvidence());
  return browser.fetch(`/admin/articles/${articleId}/rights`, { multipart: form });
}
