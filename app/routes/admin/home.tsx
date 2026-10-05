import { Form } from "react-router";
import { readableKinds } from "~/lib/cases.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { can } from "~/lib/permissions";
import { describeRoleAssignment } from "~/lib/role-names";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/home";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  return {
    email: user.email,
    canManageStaff: can(actor, { action: "role.assign" }),
    canReadUsage: can(actor, { action: "usage.read" }),
    canEditContent: can(actor, { action: "content.edit" }),
    canUpload: can(actor, { action: "media.upload" }),
    worksOnLearningLayers:
      can(actor, { action: "content.edit" }) || actor.roles.some((role) => role.role === "educator"),
    isReviewer: can(actor, { action: "reviewQueue.view" }),
    canManageSubmissions: can(actor, { action: "submission.manage" }),
    canPublishNotices: can(actor, { action: "notice.publish" }),
    canManageConsent: can(actor, { action: "consent.manage" }),
    handlesCases: readableKinds(actor).length > 0,
    roles: actor.roles.map(describeRoleAssignment),
  };
}

export default function AdminHome({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <h1>Na iSema staff</h1>
      <p>
        Signed in as <strong>{loaderData.email}</strong>.
      </p>
      <h2>Your roles</h2>
      <ul>
        {loaderData.roles.map((role) => (
          <li key={role}>{role}</li>
        ))}
      </ul>
      {loaderData.canEditContent && (
        <>
          <h2>Content</h2>
          <ul>
            <li>
              <a href="/admin/articles">Content</a>
            </li>
            <li>
              <a href="/admin/topics">Topics</a>
            </li>
            <li>
              <a href="/admin/contributors">Contributors</a>
            </li>
            <li>
              <a href="/admin/providers">Providers and offerings</a>
            </li>
          </ul>
        </>
      )}
      {loaderData.handlesCases && (
        <p>
          <a href="/admin/cases">Cases</a>
        </p>
      )}
      {loaderData.canManageSubmissions && (
        <p>
          <a href="/admin/submissions">Submissions</a>
        </p>
      )}
      {(loaderData.canPublishNotices || loaderData.canManageConsent) && (
        <>
          <h2>Privacy</h2>
          <ul>
            {loaderData.canPublishNotices && (
              <li>
                <a href="/admin/notices">Consent notices</a>
              </li>
            )}
            {loaderData.canManageConsent && (
              <li>
                <a href="/admin/consents">Consent Records</a>
              </li>
            )}
          </ul>
        </>
      )}
      {loaderData.canUpload && (
        <p>
          <a href="/admin/media">Media library</a>
        </p>
      )}
      {loaderData.worksOnLearningLayers && (
        <p>
          <a href="/admin/learning-layers">Learning Layers</a>
        </p>
      )}
      {loaderData.isReviewer && (
        <p>
          <a href="/admin/reviews">Your reviews</a>
        </p>
      )}
      {loaderData.canManageStaff && (
        <p>
          <a href="/admin/staff">Manage staff and roles</a>
        </p>
      )}
      {loaderData.canReadUsage && (
        <p>
          <a href="/admin/usage">Usage and costs</a>
        </p>
      )}
      <Form method="post" action="/admin/sign-out">
        <button type="submit">Sign out</button>
      </Form>
    </main>
  );
}
