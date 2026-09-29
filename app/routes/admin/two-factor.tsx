import { Form } from "react-router";
import { CodeField } from "~/components/code-field";
import { cloudflareContext } from "~/lib/cloudflare";
import { checkStaffCode, requireStaffStep, respondToCodeCheck } from "~/lib/staff.server";
import type { Route } from "./+types/two-factor";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Enter your code · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  await requireStaffStep(context.get(cloudflareContext).env, request, "twoFactor");
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireStaffStep(context.get(cloudflareContext).env, request, "twoFactor");
  const code = String((await request.formData()).get("code") ?? "").trim();
  return { error: respondToCodeCheck(await checkStaffCode(signedIn, request, code)) };
}

export default function TwoFactor({ actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <h1>Enter your authenticator code</h1>
      <Form method="post">
        <CodeField label="6-digit code from your authenticator app" error={actionData?.error} />
        <button type="submit">Continue</button>
      </Form>
    </main>
  );
}
