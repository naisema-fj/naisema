import type { PermittedUse } from "./rights-rules";

/** How staff pages name each Permitted Use. */
export const PERMITTED_USE_NAMES: Record<PermittedUse, string> = {
  publish: "Publish",
  excerpt: "Excerpt",
  translate: "Translate",
  transcribe: "Transcribe",
  educationalAdaptation: "Educational adaptation",
  commercial: "Commercial use",
  aiTraining: "AI training",
};
