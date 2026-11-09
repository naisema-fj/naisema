# Admin guide

This guide is for the founder. It shows how to sign in, publish something, take it down again, see who did what, and find the runbook, using the v1 staff site (ADR-0015). Pages and buttons are named as the screen shows them. You don't need to type any commands.

Your roles decide what you see. The menu only lists pages you may use, so a page missing from your menu isn't an error.

## Sign in

1. Open `admin.naisema.com`. Cloudflare asks for your email address and sends you a code.
2. Type the code. You're on **Staff home**.
3. If it says your address isn't on the staff list, an administrator adds you at **Staff**, and the technical owner adds you to the Cloudflare Access list.

To leave, press **Sign out** at the top right of any page.

## The staff home

**Needs your attention** lists what is waiting for you:
- **Waiting for your review**: versions you can review and didn't write.
- **Ready to publish**: versions with everything they need.
- **Not ready yet**: each item with the first thing it's missing.
- **Rights running out in the next 30 days.**
- New messages and reports.

On a wide screen the menu is on the left. On a phone, press **Menu** at the top.

## Add and edit something

1. Open **Content**. Under **Add something**, choose what it is and where it goes (for example "Article in E-zine"), type a title, and press **Add and start writing**.
2. Fill in the page and press **Save as version N**. Every save is a new version, and a new version needs its reviews again. That keeps every Review Label true to the exact words published.
3. Tick the **Content Flags** that apply. They decide which reviews are needed:
   - every item needs an editorial review
   - teaching language, or anything in Learn, needs a language review
   - sensitive cultural material needs a Knowledge Holder Approval
   - identifiable children need a safeguarding review and the guardian's permission
4. To show it to a Knowledge Holder or anyone outside the team, press **Make a preview link**. Copy the address shown. It works for 14 days and shows only that version.

## Review

Open the item from **Waiting for your review**. Under **Your review of version N**, add notes, then press **Approve** or **Ask for changes**. Asking for changes needs a note saying what.

For a **Knowledge Holder Approval**, an editor records it with the Knowledge Holder's name and how they approved (in person, by phone, by email). You can't review a version you wrote: someone else must.

## Rights

From an item's page, press **Rights Records**, or use **Rights Records** beside a file in **Media library**. Add who holds the rights, what they permit, their last day if there is one, and the signed permission as a PDF or photo.

Nothing can be public until a record grants **Publish**. A Video's Learning Layer also needs **Translate**, **Transcribe** and **Educational adaptation**. To take something down at once, withdraw its record.

## Publish

On the item's page, **Where it stands** says either "This version can be published", or exactly what is missing. When it can be published, press **Publish version N**. It is on the public site at once.

| What it says | What to do |
| --- | --- |
| It needs editorial review (or language review...) | Someone with that role reviews it, from their staff home. |
| ... asked for changes | Make the change and save. The new version needs its reviews again. |
| No Rights Record for the item (or a file) grants Publish | Add the Rights Record. |
| ... is missing | Fill in that field and save. |
| Its Learning Layer has no Segments yet, or no Activity is required | The Educator finishes the Learning Layer. |

## Take it down

On the item's page, type a reason and press **Withdraw from the site**. It leaves the site, search and the sitemap at once. **Archive** takes it out of use for good. To publish it again after withdrawing, publish a version.

## Messages and reports

**Messages and reports** lists what people sent through the public forms:
- Reports go only to the Safeguarding Lead.
- Requests about people's own information go only to administrators.

Open one to read it and reply by email. Press **Mark as dealt with** when it's done.

## The audit log

**Audit log** (administrators) lists the latest 500 things anyone did: who, what, on which item, when, and why where a reason was given. Nothing in it can be changed.

## Find the runbook

The runbook is `docs/handover/runbook.md` in the project on GitHub (`naisema-fj/naisema`). It's the technical owner's manual for deploying, restoring and handling incidents. Educators have their own guide, `docs/handover/educator-guide.md`.

## Rehearsal checklist (AC-08)

Do these on staging without help, with this guide open, and note anything unclear:

- [ ] Sign in with the emailed code.
- [ ] Add an Article, write a paragraph and save it.
- [ ] Make a preview link and open it in a private window.
- [ ] Ask someone else to approve it, and add a Rights Record granting Publish.
- [ ] Publish it and find it on the public site.
- [ ] Withdraw it with a reason, and see it gone.
- [ ] Find the publish and the withdrawal in the **Audit log**.
- [ ] Sign out.
