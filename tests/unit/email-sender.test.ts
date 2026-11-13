import { describe, expect, it } from "vitest";
import { senderAddress } from "~/lib/email.server";

describe("senderAddress", () => {
  it("splits EMAIL_FROM into the { email, name } Email Service takes", () => {
    expect(senderAddress("NAISEMA <no-reply@naisema.com>")).toEqual({ email: "no-reply@naisema.com", name: "NAISEMA" });
    expect(senderAddress("NAISEMA Staging <no-reply@naisema.com>")).toEqual({
      email: "no-reply@naisema.com",
      name: "NAISEMA Staging",
    });
    expect(senderAddress('"NAISEMA" <no-reply@naisema.com>')).toEqual({
      email: "no-reply@naisema.com",
      name: "NAISEMA",
    });
  });

  it("takes a plain address as it is", () => {
    expect(senderAddress(" no-reply@naisema.com ")).toEqual({ email: "no-reply@naisema.com" });
    expect(senderAddress("<no-reply@naisema.com>")).toEqual({ email: "no-reply@naisema.com" });
  });
});
