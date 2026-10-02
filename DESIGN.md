---
name: Na iSema
description: Letters home. Fijian language and culture for Fijians abroad, signed, dated and honestly marked with what was reviewed.
colors:
  sand: "#eee7d9"
  sheet: "#fbf9f4"
  ink: "#1e1c19"
  ink-soft: "#4a4640"
  teal-950: "#062e36"
  teal-900: "#0a3d47"
  teal-700: "#0b5563"
  teal-200: "#b9d6d8"
  teal-100: "#e1eeee"
  masi: "#6b3a22"
  masi-200: "#e8d7c7"
  rule: "rgb(10 61 71 / 0.22)"
typography:
  display:
    fontFamily: "Jost Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.3rem, 1.6rem + 3.2vw, 3.9rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Jost Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.4rem, 1.2rem + 0.8vw, 1.75rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Jost Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
  wordmark:
    fontFamily: "Jost Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 650
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Literata Variable, Georgia, Times New Roman, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  body-reading:
    fontFamily: "Literata Variable, Georgia, Times New Roman, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.75
  lede:
    fontFamily: "Literata Variable, Georgia, Times New Roman, serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.5
  nav:
    fontFamily: "Jost Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
  postmark:
    fontFamily: "Jost Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    letterSpacing: "0.1em"
    fontFeature: "tnum"
  label:
    fontFamily: "Jost Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    letterSpacing: "0.12em"
rounded:
  none: "0"
  focus: "2px"
  sm: "3px"
  md: "4px"
spacing:
  gutter: "clamp(1rem, 0.6rem + 2vw, 2.5rem)"
  stack: "1rem"
  list-item: "1.25rem"
  letter-block: "clamp(1.75rem, 1.2rem + 2.5vw, 3.5rem)"
  letter-inline: "clamp(1.25rem, 0.8rem + 3vw, 3.75rem)"
  section: "clamp(3rem, 2rem + 4vw, 5.5rem)"
  envelope-gap: "clamp(1rem, 0.6rem + 1.5vw, 1.75rem)"
components:
  button-primary:
    backgroundColor: "{colors.teal-900}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.sm}"
    padding: "0.8rem 1.4rem"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.teal-950}"
    textColor: "{colors.sheet}"
  nav-link:
    textColor: "{colors.ink}"
    typography: "{typography.nav}"
    padding: "0.35rem 0"
  nav-link-hover:
    textColor: "{colors.teal-700}"
  nav-link-active:
    textColor: "{colors.teal-900}"
  menu-toggle:
    textColor: "{colors.teal-900}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.9rem"
    height: "44px"
  menu-toggle-open:
    backgroundColor: "{colors.teal-100}"
  letter-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.letter-block} {spacing.letter-inline}"
    width: "46rem"
  envelope:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "1rem 1rem 1.4rem"
  postmark:
    textColor: "{colors.teal-700}"
    typography: "{typography.postmark}"
    padding: "0.2rem 0"
  callout:
    backgroundColor: "{colors.teal-100}"
    rounded: "{rounded.none}"
    padding: "1rem 1.25rem"
  site-footer:
    backgroundColor: "{colors.teal-900}"
    textColor: "{colors.sheet}"
---

# Design System: Na iSema

## Overview

**Creative North Star: "Letters home"**

Every public page is a letter from home: an off-white sheet laid on a slightly deeper sand ground, written in deep teal ink, edged with an airmail band in teal and masi brown, and marked with flat postmark lines that state when it was sent and exactly what it was reviewed for. The system is quiet, factual and warm. It reads like correspondence, not like a portal: one sheet per page, a signature, a dateline, envelopes that point to the six areas.

Density is low and the reading measure is held. Depth is paper-on-table: sheets carry a soft, long shadow; nothing else floats. Interaction is native and script-free: envelopes lift on hover and keyboard focus, the mobile menu is a native disclosure, and every motion has a reduced-motion fallback. Tapa depth is restrained to a single masi strip at the top of the footer, which is a labelled placeholder until commissioned, culturally reviewed artwork arrives.

The photo hero over a grid of image cards is rejected for this world; areas are addressed as envelope fronts, and pieces are listed as ruled lines.

**Key Characteristics:**
- Off-white sheets (square-cornered) on a sand ground, with a soft long shadow.
- The airmail edge: a -45deg teal and masi stripe at the head of the page and of every letter, and as the border of envelopes and embedded items.
- Postmark lines: small, uppercase, letter-spaced Jost between two hairline rules; flat and factual, never seals or badges.
- Jost for interface and headings, Literata for reading.
- An empty, double-ruled stamp box on every envelope; no stamp art until commissioned work exists.
- No client JavaScript on public pages; interaction is CSS and native HTML only. Two exceptions: a public form loads Cloudflare Turnstile's widget, the only script its page allows, and a contributor's private upload link page runs the resumable uploader. Both are uncached and work like every other page apart from that.

## Colors

Two inks on paper: deep teal does almost all the work, masi brown is the second colour of the airmail edge and the colour of things that are signed or labelled.

### Primary
- **Deep Teal Ink** (teal-900): headings, the wordmark, the primary button, the footer field, the active nav item. The voice of the site.
- **Airmail Teal** (teal-700): body links, postmark lines, list marks, the teal stripe of the airmail edge, the stamp box rule. Holds 8:1 on the sheet and 6.8:1 on sand.
- **Night Teal** (teal-950): hover state of the primary button and the darkened airmail edge on a lifted envelope.

### Secondary
- **Masi Brown** (masi): the second stripe of the airmail edge, the signature, small uppercase labels ("From", "Topics", "Review Labels", "Not open yet"), envelope availability marks, the active nav underline, blockquote rule, and the focus ring (3px). 8.9:1 on the sheet.
- **Masi Wash** (masi-200): link hover and focus ring on the dark teal footer.

### Neutral
- **Sand Ground** (sand): the page background behind every sheet.
- **Letter Sheet** (sheet): letters, envelopes, header bar, the light stripes of the airmail edge, text on the teal footer.
- **Near-Black Ink** (ink): body text.
- **Soft Ink** (ink-soft): ledes, descriptions, sources, breadcrumb current item, empty states.
- **Teal Wash** (teal-100): callouts, open menu toggle, footer note text on teal.
- **Pale Teal** (teal-200): text selection and the nav hover underline.
- **Hairline Rule** (rule, teal at 22%): every divider, postmark rule, list separator and header border.

### Named Rules
**The Two Inks Rule.** Colour comes from deep teal and masi brown only. There is no third accent, no success green, no warning amber; state is said in words.

**The Teal Speaks, Masi Signs Rule.** Teal carries headings, links and facts (dates, formats, Review Labels). Masi carries signatures, labels that introduce a value, availability marks and focus. Do not swap them. A form's problems are written in masi, as a correction signed beside the field, and always said in words ("Nothing was sent"), never by colour alone.

## Typography

**Display Font:** Jost Variable (with Avenir Next, Segoe UI, system-ui)
**Body Font:** Literata Variable (with Georgia, Times New Roman)

Both are self-hosted (OFL-1.1). Founder approval under MOU §5 is pending, so the pairing is provisional; the fallback stacks are part of the system and must stay legible on their own.

**Character:** A clean geometric sans that addresses the envelope, and a warm book serif that carries the letter. Headings are tight and balanced; reading text is generous.

### Hierarchy
- **Display** (Jost 600, fluid 2.3 to 3.9rem, 1.1, -0.015em): page and letter titles; the salutation ("Bula vinaka").
- **Headline** (Jost 600, fluid 1.4 to 1.75rem, 1.1): section headings; envelope addressee names.
- **Title** (Jost 600, 1.25rem, 1.25): list item links, h3, the signature.
- **Body** (Literata 400, 1.0625rem, 1.65): default page text.
- **Body reading** (Literata 400, 1.125rem, 1.75, max 68ch): article bodies. The welcome letter scales this up (fluid 1.2 to 1.45rem, 1.6, max 40rem).
- **Lede** (Literata 400, 1.25rem, 1.5, soft ink): the summary under a title.
- **Nav** (Jost 500, 1rem; 1.15rem in the mobile menu): area links.
- **Postmark** (Jost 600, 0.8125rem, 0.1em, uppercase, tabular numerals): datelines, format, Review Labels, list marks, envelope marks.
- **Label** (Jost 600, 0.8125rem, 0.12em, uppercase, masi): the word that introduces a value or a postmark group.

### Named Rules
**The Sans Addresses, Serif Speaks Rule.** Jost for anything that names, labels, navigates or marks; Literata for anything meant to be read as sentences.

**The Tabular Date Rule.** Every date is a postmark: uppercase Jost with tabular numerals, written "21 Sept 2026" in a machine-readable time element.

## Layout

One page column, 76rem wide inside one fluid gutter, shared edge-to-edge by the header, main and footer. Letters sit centred at 46rem (40rem for short pages and errors); article text holds a 68ch measure. Inside a letter, children stack at 1rem; reading text stacks at 1.1em, with 2em above an h2 and 0.5em below any heading so it belongs to what follows.

The homepage is a grid: one column on phones, two (2fr and 1fr) from 60rem, with the welcome letter and the envelopes spanning both. The welcome letter spans the full column, with its dateline set top right; below 40rem the dateline drops under the title. Envelopes run three across, two below 60rem, one below 34rem (where they lose their 8:5 aspect for a 11rem minimum). The header nav collapses into the disclosure menu below 52rem. All touch targets that are controls hold a 44px minimum.

## Elevation & Depth

Paper on a table. Sheets have a faint contact shadow and a long, teal-tinted drop shadow; envelopes rest nearly flat and lift on hover or focus. Everything else is flat: postmarks, rules, lists, callouts. Shadows are soft and teal-tinted, never hard-offset.

### Shadow Vocabulary
- **Sheet** (`0 1px 2px rgb(30 28 25 / 0.06), 0 22px 48px -30px rgb(6 46 54 / 0.35)`): every letter.
- **Envelope at rest** (`0 2px 4px rgb(30 28 25 / 0.05)`).
- **Envelope lifted** (`0 18px 30px -18px rgb(6 46 54 / 0.45)`, with translateY(-3px)): hover and keyboard focus.
- **Button** (`0 6px 16px -10px rgb(6 46 54 / 0.6)`): the primary button only.
- **Menu drop** (`0 16px 32px -20px rgb(6 46 54 / 0.4)`): the open mobile menu panel.

### Named Rules
**The Only Sheets Float Rule.** Shadows belong to paper objects (letters, envelopes, the open menu) and the single primary button. Lines and labels stay flat on the page.

## Shapes

Square paper. Sheets, envelopes, callouts and embedded items have no radius. The only rounding is functional: 3px on the primary button, 4px on the menu toggle, 2px on the focus ring. Structure is drawn with 1px hairline rules, not boxes. The airmail edge appears as a 6 to 8px band on headers and letters, and as a 4 to 5px stripe border (gradient border-box behind a sheet padding-box) on envelopes and embedded items. The stamp box is a 2.75 by 3.25rem rectangle ruled once in teal and again, 3px out, in hairline.

## Components

### Buttons
Firm and quiet; there is one per view.
- **Shape:** barely rounded (3px).
- **Primary:** deep teal fill, sheet text, Jost 600, 0.8rem 1.4rem, 44px minimum, soft button shadow.
- **Hover / Focus:** fills night teal and rises 1px over 200ms ease-out; focus is the masi 3px ring at 3px offset. Reduced motion removes the rise.

### Links
- Airmail teal, 1px underline at 0.22em offset; on hover, deep teal and a 2px underline (160ms).
- On the teal footer, sheet-coloured with a masi wash hover and focus ring.

### Letter (signature)
The sheet itself: sheet background, square corners, fluid padding, the sheet shadow, and a 6px airmail band across its head. Its header stacks title, lede, a "From" line and postmarks; its foot is set off by a hairline rule and 2.5rem.

### Postmarks (signature)
Flat factual lines: uppercase postmark type in airmail teal, each fact between top and bottom hairline rules, wrapping in a row with 1.25rem between. Review Labels sit apart, under their own masi label and a hairline, with their rules drawn in full airmail teal. When there are none, a plain line says so ("None on this version.").

### Envelope (signature)
An area addressed as an envelope front: 8:5 sheet, 5px fine airmail border, the area name and description set as the address in the lower half, an empty double-ruled stamp box top right, and any availability line as a masi postmark set beside the stamp like a cancellation. On hover and focus it lifts 3px, the shadow lengthens, and the edge's teal darkens to night teal (260ms ease-out).

### Navigation
- **Header:** sheet bar under an 8px airmail band, hairline bottom rule; wordmark at left, area links inline at right (Jost 500, ink).
- **States:** hover turns teal with a pale teal 2px underline; the current area is deep teal with a masi 2px underline.
- **Mobile:** below 52rem a native disclosure ("Menu" with three drawn bars, 1px hairline border, 4px radius, teal wash when open) drops a full-width sheet panel listing areas at 1.15rem, ruled between.
- **Breadcrumb:** Jost 0.9rem, slash-separated, current item in soft ink.

### Lists of pieces
Ruled lines, not cards: each item between hairlines with 1.25rem padding, a Jost title link, a Literata summary, and a teal postmark list mark.

### Notices
- **Not open yet:** Jost 1rem text in deep teal between two masi rules, introduced by a masi "Not open yet" label.
- **Callout:** teal wash block, no border, 1rem 1.25rem.
- **Embedded item:** sheet block with a 4px airmail border, Jost 600.

### Footer
A 18px masi placeholder strip (an inline SVG pattern, labelled as placeholder in the footer note), then a deep teal field with sheet-coloured links and a teal wash note at 60ch.

## Do's and Don'ts

### Do:
- **Do** put every page's content on a sheet over the sand ground, headed by the airmail band.
- **Do** state dates, formats and Review Labels as postmark lines: uppercase Jost 600 at 0.8125rem, 0.1em tracking, tabular numerals, between hairline rules.
- **Do** say what isn't open yet in plain words, as a ruled line, rather than hiding or disabling it.
- **Do** label placeholder art as placeholder, in visible text near it.
- **Do** build interaction from CSS and native HTML (hover, focus-visible, details/summary), with a reduced-motion fallback for every transform.
- **Do** use the masi 3px focus ring at 3px offset (masi wash on the teal footer).

### Don't:
- **Don't** show a "verified" badge, seal, tick or stamp-like roundel; Review Labels are flat lines generated from real approvals.
- **Don't** fill the stamp box or the masi strip with invented cultural imagery; they stay empty or placeholder until commissioned, culturally reviewed artwork exists.
- **Don't** introduce a third accent colour or colour-coded status.
- **Don't** round sheets, envelopes or callouts.
- **Don't** use hard-offset shadows or shadows on lines, labels and lists.
- **Don't** use glyph or icon-font icons; draw small marks in CSS (as the menu bars are).
- **Don't** replace the envelopes with photo cards or lead a page with a photo hero.
