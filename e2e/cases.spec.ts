import { expect, test } from "@playwright/test";
import { confirmTwoFactorCode, expectNoAxeViolations, followSignInLink, startTwoFactorSetup } from "./support";

const ARTICLE = "/ezine/e2e-letter-from-home";

/** Stands in for Turnstile's widget, which the test machine may not reach (as in forms.spec.ts). */
const TURNSTILE_STUB = `for (const widget of document.querySelectorAll(".cf-turnstile")) {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "cf-turnstile-response";
  input.value = "XXXX.DUMMY.TOKEN.XXXX";
  widget.append(input);
}`;

test("a visitor reports an article and the safeguarding lead triages and decides it (AC-05)", async ({
  page,
}, testInfo) => {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: TURNSTILE_STUB }),
  );
  const details = `E2E: ${testInfo.project.name} ${Date.now()} the photo names a child's school.`;
  await page.goto(ARTICLE);
  await page.getByRole("link", { name: "Report a problem with this article" }).click();
  await expect(page.getByText("You're reporting")).toBeVisible();
  await page.getByLabel("It could hurt or endanger someone").check();
  await page.getByLabel("Tell us more").fill(details);
  await page.getByRole("button", { name: "Send the report" }).click();
  await expect(page.getByRole("heading", { name: "Thank you for telling us" })).toBeVisible();
  const reference = (await page.getByRole("status").textContent())?.match(/reference ([0-9A-F]{8})/)?.[1];
  expect(reference).toBeTruthy();

  await followSignInLink(page, `e2e-lead-${testInfo.project.name}@naisema.test`);
  await confirmTwoFactorCode(page, await startTwoFactorSetup(page));
  await page.getByRole("link", { name: "Cases" }).click();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: reference as string }).click();
  await expect(page.getByText(details)).toBeVisible();
  await expect(page.getByText("Anonymous: they can't be told the outcome")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel("How serious is it?").selectOption("high");
  await page.getByLabel("Owner").selectOption({ label: `e2e-lead-${testInfo.project.name}@naisema.test` });
  await page.getByRole("button", { name: "Triage" }).click();
  await expect(page.getByRole("status")).toHaveText("Triaged.");

  await page.getByLabel("Outcome").selectOption("content_changed");
  await page.getByLabel("What was done").fill("Asked the editor to crop the school badge.");
  await page.getByLabel("Why").fill("It identifies a child.");
  await page.getByRole("button", { name: "Record the decision" }).click();
  await expect(page.getByRole("status")).toHaveText("Decision recorded.");
  await page.getByRole("button", { name: "Close the Case" }).click();
  await expect(page.getByRole("status")).toHaveText("Closed.");
  await expectNoAxeViolations(page);
});
