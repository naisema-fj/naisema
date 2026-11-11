import { describe, expect, it } from "vitest";
import { CONTENT_FLAGS, REVIEW_TYPES } from "~/lib/content-rules";
import { PERMITTED_USES } from "~/lib/rights-rules";
import { can, ROLES } from "~/lib/roles";
import { FLAG_HELP, PERMITTED_USE_HELP, REVIEW_HELP, ROLE_DOES } from "~/lib/staff-help";

describe("the staff site's help", () => {
  it("says something, as a sentence, for every role, flag, review and permitted use", () => {
    const entries = [
      ...ROLES.map((role) => ROLE_DOES[role]),
      ...CONTENT_FLAGS.map((flag) => FLAG_HELP[flag]),
      ...REVIEW_TYPES.map((type) => REVIEW_HELP[type]),
      ...PERMITTED_USES.map((use) => PERMITTED_USE_HELP[use]),
    ];
    for (const text of entries) expect(text).toMatch(/^\S.*[.”]$/);
  });

  it("doesn't tell a role it can publish when it can't", () => {
    for (const role of ROLES) {
      const mayPublish = can({ roles: [role] }, "content.publish");
      expect(/\bpublishes\b/.test(ROLE_DOES[role]) && !/Never publishes/.test(ROLE_DOES[role])).toBe(mayPublish);
    }
  });
});
