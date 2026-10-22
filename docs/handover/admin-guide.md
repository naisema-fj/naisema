# Admin guide

For the founder. This guide shows how to sign in, publish something, take it down again, export information, read the audit log and find the runbook. It uses the staff site as it looks today, and names each page and button as the screen shows it. You do not need to type any commands.

Your role decides what you see. The menu only lists pages you may use, so a page missing from your menu is not an error.

## Sign in

1. Open the staff site address (`admin.naisema.com`). The page is called **Sign in to NAISEMA staff tools**.
2. Type your email address in **Email address** and press **Email me a sign-in link**.
3. The next page says **Check your email**. Open the email and press the link. It works once and expires after 15 minutes. If no email comes, check spam, then ask for a new link. The page gives the same reply whether or not the address has an account.
4. The first time only, the page **Set up your authenticator app** appears. Press **Start setup**, scan the QR code with an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or 1Password), type the 6-digit code under **2. Enter the code your app shows**, and press **Confirm**.
5. Every later sign-in ends on **Enter your authenticator code**. Type the 6-digit code and press **Continue**. Five wrong codes sign you out, and you start again from step 2.

If you lose your phone, another administrator presses **Reset two-factor for** your email under **Two-factor** on **Staff and roles**. You are signed out everywhere and emailed, and you set up the app again at your next sign-in. You cannot reset your own. If you are the only administrator, the technical owner can do it (runbook, "A lost authenticator app").

To leave, press **Sign out** at the top right of any page.

## The staff home

After sign-in you land on **NAISEMA staff**. From top to bottom:

- **Needs your attention**: a list of things waiting for you, each with a count. Press one to go straight to it. If there is nothing, it says **Nothing needs your attention.**
- **Platform**: one line per system check, such as backups. A line that ends **Needs attention.** is a problem to pass to the technical owner. Press its link to see more.
- **Your roles**: the roles you hold.
- **Where to go**: the same pages as the menu, in groups.

The menu is on the left on a wide screen. On a phone, press **Menu** at the top. **Search** at the top finds content, media and directory entries.

## Publish an eligible item

Anything the public sees must pass review and have its rights recorded first. The staff site checks this for you and shows what is missing.

1. Open **Content** from the menu. The page lists items, newest saved first. Press an item's title.
2. Press **Review and publish revision** (the number is the latest revision) near the top of the page.
3. Find the section **Review and publishing**. It shows:
   - **This revision**: for example Draft, Submitted for review or Approved.
   - **Publishing**: either **Ready to publish** or **Not ready to publish**. If the revision is already live it says **This revision is the one published.**
4. If it says **Ready to publish**, press **Publish revision** (with its number) under **Publishing**. The page confirms with **Published.** The item appears on the public site, and public search picks it up.

### When an item cannot be published

If it says **Not ready to publish**, a list titled **Before revision N can be published** says exactly what is missing. Where you can fix it yourself, a link sits beside the line. The usual reasons:

| What the list says | What to do |
| --- | --- |
| It hasn't been submitted for review. | Press the link, then **Submit revision N for review**. |
| A review (for example Language review, Cultural review or Knowledge Holder Approval) is still needed, or was rejected. | An editor assigns a reviewer with **Assign**; the reviewer presses **Record decision**; a Knowledge Holder Approval is entered with **Record approval**. A rejection needs the item changed and saved again, which makes a new revision to submit. |
| There is no current Rights Record granting Publish, or the file it uses has none. | Open **Rights Records** from the item's page and record the rights. The media library has the same for files. |
| Its video hasn't finished processing, or a file hasn't passed its virus scan. | Wait a few minutes and reload. If it stays stuck, tell the technical owner. |
| It is hidden while a Case about it is reviewed. | Only the safeguarding lead can show it again. You cannot override this. |

You cannot approve a revision you wrote yourself. Someone else must.

## Withdraw an item

1. Open the item the same way (**Content**, then its title, then **Review and publish revision**).
2. In **Review and publishing**, find the **Withdraw the** button for the item (for an article, **Withdraw the article**). Above it, **Why (optional, kept in the audit log)** takes a short reason. Write one; it helps later.
3. Press the button. The page says **Withdrawn.** The public page then answers "gone" and the item leaves search.

A withdrawn item can be published again by publishing a revision. To remove it from the lists for good, use **Archive the** button that appears for withdrawn items. To take down several items at once, tick them on the **Content** page and use the actions under the list.

## Export data

1. Open **Exports** from the menu.
2. Each export has its own heading and a **Download** button. The file is saved as one `.json` file named with the export and the date.
3. **Contacts from the public forms** first asks **What the contacts are for**. Write at least ten characters. The reason is recorded in the audit log.
4. Each export lists who made it in the audit log. The contents of each file are described in `docs/handover/exports.md`.

## Read the audit log

Open **Audit log** under **Administration** (administrators only). It lists who did what to which object and when, with the reason where one was given. Times are in UTC. Nothing here can be changed or removed.

To narrow it, fill in any of **Object ID**, **Who acted** or **Action starts with** (for example `role.` or `content_item.`) and press **Show**. Press **Older events** at the bottom for earlier entries.

## Find the runbook

The runbook is the file `docs/handover/runbook.md` in the project on GitHub (`naisema-fj/naisema`). It is the technical owner's manual for deploying, restoring from backup, monitoring and handling incidents. Pages on the staff site point to it where it matters, for example **Usage and costs** and **Backups and restoring**. Share this link with whoever will help you run the platform.

Other pages worth knowing:

- **Usage and costs**: this month's video and storage use, and the estimated bill against the monthly ceiling.
- **Backups and restoring**: backups held, and the restore steps used after a disaster.
- **Staff and roles**: grant or revoke a role, and reset someone's two-factor.

## AC-08 rehearsal checklist

Do these on staging without help, with this guide open. Note anything that was unclear or took more than a couple of minutes.

- [ ] Sign in with the emailed link and your authenticator code.
- [ ] From **NAISEMA staff**, find what is under **Needs your attention**.
- [ ] Publish an eligible item: open it from **Content**, check it says **Ready to publish**, press **Publish revision**, and see **Published.**
- [ ] Open a draft that is not ready and read out why it cannot be published.
- [ ] Withdraw the item you published, with a reason.
- [ ] Download an export from **Exports** and open the file.
- [ ] Open the **Audit log** and find the publish and the withdrawal you just made.
- [ ] Find the runbook and the section on backups.
- [ ] Sign out.

Report what was unclear on the ticket for this guide so the wording can be fixed.
