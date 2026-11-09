import { LAYER_LANGUAGE_VARIETY } from "./learning-layer-fields";
import { type Actor, can } from "./permissions";

/** Whether an actor works on the dictionary drafts: editors, Educators and Standard Fijian language reviewers. */
export const worksOnDictionary = (actor: Actor) =>
  can(actor, { action: "content.edit" }) ||
  actor.roles.some(
    (role) =>
      role.role === "educator" ||
      (role.role === "reviewer" && role.reviewType === "language" && role.languageVariety === LAYER_LANGUAGE_VARIETY),
  );
