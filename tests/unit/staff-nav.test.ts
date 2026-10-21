import { describe, expect, it } from "vitest";
import type { Actor, RoleAssignment } from "~/lib/permissions";
import { isCurrentNavItem, staffNav } from "~/lib/staff-nav";

const staff = (...roles: RoleAssignment[]): Actor => ({ userId: "u", roles });
const labels = (actor: Actor) => staffNav(actor).flatMap((group) => group.items.map((item) => item.label));
const groupNames = (actor: Actor) => staffNav(actor).map((group) => group.name);

describe("the staff navigation", () => {
  it("shows an administrator the administration pages and not the editing ones", () => {
    const nav = labels(staff({ role: "administrator" }));

    expect(nav).toEqual(
      expect.arrayContaining(["Staff and roles", "Exports", "Audit log", "Usage and costs", "Backups and restoring"]),
    );
    expect(nav).toContain("Consent notices");
    expect(nav).not.toContain("Content");
    expect(nav).not.toContain("Your reviews");
  });

  it("shows an editor the content pages, submissions and the editors' exports", () => {
    const nav = labels(staff({ role: "editor" }));

    expect(nav).toEqual(
      expect.arrayContaining([
        "Content",
        "Topics",
        "Contributors",
        "Providers and offerings",
        "Media library",
        "Learning Layers",
        "Submissions",
        "Exports",
      ]),
    );
    expect(nav).not.toContain("Staff and roles");
    expect(nav).not.toContain("Audit log");
    expect(nav).not.toContain("Cases");
  });

  it("shows an educator Learning Layers and the media library, but not the content pages", () => {
    const nav = labels(staff({ role: "educator" }));

    expect(nav).toEqual(["Media library", "Learning Layers"]);
  });

  it("shows a reviewer their reviews and nothing to edit or administer", () => {
    expect(labels(staff({ role: "reviewer", reviewType: "language", languageVariety: "standard-fijian" }))).toEqual([
      "What's coming up",
      "Your reviews",
    ]);
  });

  it("offers What's coming up to the roles that have something on it, and not to an Educator", () => {
    for (const role of ["editor", "safeguarding_lead", "privacy_contact"] as const) {
      expect(labels(staff({ role }))).toContain("What's coming up");
    }
    expect(labels(staff({ role: "educator" }))).not.toContain("What's coming up");
  });

  it("shows the safeguarding lead Cases, and the privacy contact Cases, Consent Records and notices", () => {
    expect(labels(staff({ role: "safeguarding_lead" }))).toContain("Cases");
    expect(labels(staff({ role: "privacy_contact" }))).toEqual(
      expect.arrayContaining(["Cases", "Consent notices", "Consent Records", "Exports"]),
    );
  });

  it("combines what each of a person's roles allows, without repeating a page", () => {
    const nav = labels(staff({ role: "editor" }, { role: "reviewer", reviewType: "editorial" }));

    expect(nav).toContain("Content");
    expect(nav).toContain("Your reviews");
    expect(new Set(nav).size).toBe(nav.length);
  });

  it("has no empty groups, and nothing for someone with no staff role", () => {
    for (const actor of [staff({ role: "administrator" }), staff({ role: "editor" }), staff({ role: "educator" })]) {
      expect(staffNav(actor).every((group) => group.items.length > 0)).toBe(true);
    }
    expect(staffNav(staff())).toEqual([]);
    expect(groupNames(staff({ role: "editor" }))).toEqual([
      "Overview",
      "Content",
      "People and privacy",
      "Administration",
    ]);
  });
});

describe("which navigation item is the current page", () => {
  it("matches a page and the pages under it, but not a page that only shares a prefix", () => {
    expect(isCurrentNavItem("/admin/articles", "/admin/articles")).toBe(true);
    expect(isCurrentNavItem("/admin/articles/abc/history", "/admin/articles")).toBe(true);
    expect(isCurrentNavItem("/admin/articles-old", "/admin/articles")).toBe(false);
    expect(isCurrentNavItem("/admin/media", "/admin/articles")).toBe(false);
  });

  it("matches the staff home only on the staff home", () => {
    expect(isCurrentNavItem("/admin", "/admin")).toBe(true);
    expect(isCurrentNavItem("/admin/", "/admin")).toBe(true);
    expect(isCurrentNavItem("/admin/articles", "/admin")).toBe(false);
  });
});
