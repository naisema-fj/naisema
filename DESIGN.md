---
name: NAISEMA
description: "The front room. The family's vale: a Shell ground, Sand mats, soft cushions in the area colours, and one Lucide line icon beside every word that needs one."
colors:
  ink: "#0f2b35"
  ink-deep: "#0a1d24"
  ink-2: "#1b3f4c"
  ink-soft: "#dde6e8"
  kesa: "#d2603f"
  kesa-deep: "#a9472a"
  kesa-soft: "#f6dfd5"
  voivoi: "#e9be5b"
  voivoi-light: "#f1cd78"
  voivoi-soft: "#f8eccb"
  shell: "#f6f5f2"
  shell-dim: "#d5dfe2"
  sand: "#e8e5de"
  sand-deep: "#dcd8cf"
  paper: "#ffffff"
  line: "#d6d2c8"
  line-soft: "#e3dfd6"
  line-faint: "#ece9e2"
  muted: "#56686e"
  mist: "#a9bcc2"
  green: "#1d5b45"
  green-soft: "#e3efe8"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(3.2rem, 2rem + 5vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 1.8rem + 3.4vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 1.3rem + 1.1vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title-small:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Jost Variable, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  body-reading:
    fontFamily: "Jost Variable, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Jost Variable, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  mat: "28px"
  panel: "24px"
  plate: "18px"
  control: "14px"
  pill: "999px"
  seat: "50%"
spacing:
  gutter: "clamp(1rem, 0.6rem + 2vw, 3rem)"
  measure: "66ch"
  page-max: "80rem"
  pane: "48rem"
  target: "44px"
  control-height: "52px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 1.4rem"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.shell}"
  button-soft:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 1.4rem"
    height: "52px"
  button-soft-hover:
    backgroundColor: "{colors.sand-deep}"
    textColor: "{colors.ink}"
  back-link:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 1rem 0 0.75rem"
    height: "44px"
  nav-link-current:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell}"
    rounded: "{rounded.pill}"
    padding: "0 0.8rem"
    height: "44px"
  search-pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 1.1rem 0 0.9rem"
    width: "9rem"
  welcome-mat:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.mat}"
  page-head:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.mat}"
    padding: "clamp(1.5rem, 1rem + 2vw, 2.75rem)"
  head-plate:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "1.1rem 1.3rem"
  cushion-learn:
    backgroundColor: "{colors.kesa}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "clamp(1.1rem, 0.9rem + 0.8vw, 1.65rem)"
  cushion-voices:
    backgroundColor: "{colors.voivoi-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  cushion-discover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  cushion-connect:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell}"
    rounded: "{rounded.panel}"
  cushion-resources:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.shell}"
    rounded: "{rounded.panel}"
  seat:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.kesa-deep}"
    rounded: "{rounded.seat}"
    size: "3.5rem"
  shelf:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
    padding: "0.5rem"
  shelf-item-hover:
    backgroundColor: "{colors.shell}"
    rounded: "{rounded.plate}"
  review-labels:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "1.25rem 1.4rem"
  notice:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "1rem 1.15rem"
  input-text:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.75rem 1rem"
    height: "52px"
  footer:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell}"
  staff-state-live:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green}"
    rounded: "{rounded.seat}"
---

# Design System: NAISEMA

## Overview

**Creative North Star: "The Front Room"**

NAISEMA is the family's front room, the vale: you come in, someone says Bula, and everything is within reach. The ground is Shell; quieter groupings (the welcome, the ways to join in, search, form intros, notices, plain page heads) sit on Sand mats; the things you can open are soft cushions in their area's colour, resting on a low, warm, Ink-tinted shadow. Few things share a screen, and each is plainly signed with one Lucide line icon on a round seat and a word.

Bricolage Grotesque speaks, in warm sentence-case greetings at large sizes; Jost is read. The woven strip, the brand's approved artwork, is the hem of the welcome mat and the top of the footer, and the woven N mark sits in the header, the welcome and the footer. Everything is server-rendered; the only "interaction" on public pages is CSS and native disclosures. The world rejects both a photo hero over image cards and the loud tile mosaic it replaced.

The staff site is the same room set for work: white cushions on Shell at 24px corners, thumb-sized controls, an icon beside each page, action and state, and one extra state colour (green) that the public site never uses.

**Key Characteristics:**
- Shell ground, Sand mats, cushions in the six area tones; depth from soft corners and one warm shadow pair.
- One Lucide line icon (1.75 stroke) beside every area, kind, fact, form, stage and action, always with its word.
- Round seats behind icons; icons never stand alone, never replace a word.
- Bricolage for greetings and headings, Jost for everything read; sentence case throughout.
- The woven strip as hem, the woven N mark as the only emblem.
- No client JavaScript on public pages, no inline styles; native `<details>` for menus and help.

## Colors

A warm, quiet palette: the four binding brand colours, their soft tints for icon seats, and a family of sand and line neutrals that make the room feel lived in rather than white.

### Primary
- **Ink** (`ink`): text, the main button, the current menu item, the Connect cushion and the footer field. **Ink Deep** (`ink-deep`) is its hover and the video frame; **Ink Two** (`ink-2`) is the Resources cushion and the seat inside Connect.
- **Ink Mist** (`ink-soft`): the soft seat tint for Connect and Resources pieces on the shelf.

### Secondary
- **Kesa** (`kesa`): the Learn cushion and Learn page heads, link underlines and the woven strip. It is a large-field colour only.
- **Kesa Deep** (`kesa-deep`, 5.3:1 on Shell): small text, icons on light grounds, list markers, error edges and the focus ring.
- **Kesa Blush** (`kesa-soft`): the seat behind Review Label icons, Learn pieces on the shelf, the current item in the phone menu, staff warning tints.

### Tertiary
- **Voivoi** (`voivoi`): the updates panel, text selection, the seat inside Voices and E-zine cushions, icons on Ink (Connect seat, current nav icon), footer link hover and focus.
- **Voivoi Light** (`voivoi-light`): a lighter Voivoi kept for the language player.
- **Voivoi Cream** (`voivoi-soft`): the Voices and E-zine cushions, quotations in reading text, Voices pieces on the shelf.

### Neutral
- **Shell** (`shell`): the ground of every page, seats on coloured cushions, the plate that carries small text over Kesa.
- **Sand** (`sand`): mats, the soft button, the back pill, notices, fact seats, "What's this?" bodies. **Sand Pressed** (`sand-deep`) is the hover of every Sand button and pill.
- **Paper** (`paper`): the shelf, the Discover cushion, forms, the Review Labels panel, the search pill, the phone menu.
- **Line** (`line`), **Line Soft** (`line-soft`), **Line Faint** (`line-faint`): header rule and Discover edge; inset 1px edges of white panels; dividers between shelf rows and label lines.
- **Muted** (`muted`): secondary text, meta, arrows at rest. **Mist** (`mist`) and **Shell Dim** (`shell-dim`): quiet text on Ink (footer notes, sub-lines on Connect and Resources).

### Staff only
- **Garden Green** (`green`) and **Green Wash** (`green-soft`): "published / approved / live" state on the staff site (success messages, the ready-to-publish seat, the live step of the progress tracker). Never on public pages.

### Named Rules
**The Kesa Floor Rule.** Small text never sits on Kesa. Anything smaller than a heading on a Kesa field rides a Shell plate (the Learn cushion's words, the Learn page head's lede).

**The Area Tone Rule.** Each area owns one tone, shared by its menu seat, its homepage cushion, its page head and the seats of its pieces: Learn Kesa, Voices and E-zine Voivoi Cream with Voivoi seats, Discover Paper with a Line edge, Connect Ink with Voivoi icons, Resources Ink Two. Pages with no area use Sand with Kesa Deep icons.

**The Staff Green Rule.** Green means "this is live or approved" and lives only on the staff site; the public site states review with words and the icon of what was reviewed, never colour alone.

## Typography

**Display Font:** Bricolage Grotesque Variable (with Arial Narrow, system-ui)
**Body Font:** Jost Variable (with Century Gothic, Avenir Next, system-ui)

**Character:** Bricolage is the host saying Bula: heavy, tight, slightly irregular at display sizes. Jost is calm geometric reading text, set large (17px base) for phones.

### Hierarchy
- **Display** (800, step-5, 0.9, -0.035em): the welcome greeting only ("Bula vinaka").
- **Headline** (800, step-4, 0.95, -0.03em): page `h1` in the page head, held to 18ch.
- **Title** (700, step-2, 1.05, -0.02em): section `h2`. Cushion names run 700 at clamp(1.45rem to 1.9rem); the Learn cushion's name runs 800 at clamp(2.5rem to 3.75rem).
- **Title Small** (700, step-1): `h3`, shelf titles (700, clamp(1.15rem to 1.35rem), 1.2).
- **Body** (400, step-0 at 1.0625rem, 1.6): everything read. Reading columns (`body-reading`, 1.125rem, 1.75) hold a 66ch measure.
- **Label** (500 to 600, step-small at 0.95rem): meta, datelines, back pill, hints. Numbers use tabular figures.

### Named Rules
**The Sentence Case Rule.** Every heading, label, column name and button is sentence case. No uppercase labels, no tracked-out small caps, no eyebrow line above a heading; the only tracked type is the NAISEMA wordmark itself.

**The Greeting Rule.** Display size is for the greeting. Anything else that wants to be big becomes a cushion name.

## Layout

The page column is 80rem plus a fluid gutter (clamp(1rem, 0.6rem + 2vw, 3rem)), shared by the header, main and footer. Content pages sit in a centred pane (48rem; narrow 44rem; wide 80rem) with 1.75rem between blocks; reading text holds a 66ch measure, and headings keep less space below than above.

The homepage stacks the welcome mat, "Where would you like to go?", and the close of the room, with clamp(3rem to 4.75rem) between them. The rooms grid is two columns with Learn spanning the top on phones and tablets; from 64rem it is a 1.25fr + 3 x 1fr grid with Learn the tall cushion at the left spanning two rows and cushions at least 13rem tall. Below 30rem the smaller cushions show their name and seat only.

The close of the room is a 7fr / 5fr split from 64rem: the shelf of newest pieces beside the ways to join in and the updates panel.

**The Short Shelf Rule.** When the shelf holds one piece or none, it runs the full width and the two side panels sit side by side beneath it, so the room never shows an empty corner.

**The 75rem Menu Rule.** Below 75rem the header's area links give way to a native `<details>` menu: an Ink pill that opens a Paper panel of 60px rows with seats. At 24rem and below the wordmark and mark shrink so header and menu fit one row at 320px.

Targets are at least 44px; buttons and fields are 52px.

## Elevation & Depth

Depth is soft and warm: rounded corners, tonal grounds (Shell under Sand under Paper and the area tones) and one Ink-tinted shadow pair. White panels carry a 1px inset edge instead of a border. Mats (Sand) are flat; cushions rest on a shadow and lift on approach.

### Shadow Vocabulary
- **Rest** (`--shadow-rest`): every homepage cushion at rest.
- **Lift** (`--shadow-lift`): a cushion under pointer or keyboard focus.
- **Shelf** (inset Line Soft edge plus `0 10px 24px -20px rgb(15 43 53 / 0.35)`): the shelf, public forms, staff cards.
- **Button** (`0 10px 20px -14px rgb(10 29 36 / 0.8)`): the Ink button only; the soft button is flat.
- **Menu** (Line Soft ring plus `0 24px 40px -22px rgb(15 43 53 / 0.55)`): the phone menu panel.

### Named Rules
**The Mats Lie Flat Rule.** Sand mats, notices and plates never carry a shadow; only things you can open or press do.

## Shapes

Everything is soft, in four radii from large to small: the mat (28px) for the welcome mat, page heads and forms; the panel (24px) for cushions, the shelf, Review Labels, updates and staff cards; the plate (18px) for shelf rows, notices, quotations, images and plates; the control (14px) for buttons, fields and join links. Pills (999px) are for the back link, nav links, search, subtopics and radio pills. Seats are circles. The welcome mat's lower corners drop to 8px so the woven strip can run edge to edge as its hem. Shelf-row icon tiles are rounded squares at the plate radius, not circles, so a piece's kind reads differently from an area.

## Components

### Icons and seats
The icon is the system's signature. Lucide line icons, 1.75 stroke, drawn on the server as inline SVG, `aria-hidden`, always beside their word. One icon per area (Learn BookOpen, Voices Mic, Discover Compass, Connect Users, E-zine Newspaper, Resources Library), per piece kind, per public form and per player stage, from one shared map.
- **Seat:** a round tint behind the icon: 2.75rem small, 3.5rem default, 3.75rem medium, 4.75rem large. On a cushion the seat takes the cushion's seat tone; on light grounds it is Shell or a soft tint with Kesa Deep or Ink icons.
- **Fact seat:** 2.25rem Sand circle leading each fact line ("what a piece is"), as flat lines, never badges.

### Buttons
- **Shape:** gently rounded (14px), 52px tall, icon beside the word with a 0.6rem gap.
- **Primary:** Ink with Shell text, weight 600, a soft dark shadow; hover goes Ink Deep and rises 1px.
- **Soft:** Sand with Ink text, flat; hover Sand Pressed. On the Sand welcome mat the soft button is Shell, hovering to Paper.
- **Back link:** a Sand pill, 44px, left arrow and the place's name.

### Cushions (the rooms)
- **Corner Style:** 24px.
- **Background:** the area tone; seat, arrow and sub-line take the tone's paired colours.
- **Shadow Strategy:** Rest, then Lift.
- **Signature interaction:** under pointer or keyboard focus a cushion lifts 2px, its shadow deepens to Lift, its seat swells (scale 1.06) and its arrow steps 3px forward, all on 320ms of `ease-out`. Seats rest already filled. Reduced motion removes every transform and transition.
- **Learn:** the largest cushion; its words ride a Shell plate.

### The shelf
A Paper panel of rows, each led by its kind's icon on a rounded-square tile in its area's soft tint, then a Bricolage title, a line, and meta with icons. The title is the row's one link, stretched over the row; hover tints the row Shell and steps the arrow forward; focus outlines the whole row in Kesa Deep.

### Page head
A 28px mat in the area tone (Sand when none) with a large seat and the `h1`; anything smaller rides a Shell plate beside it.

### Review Labels
A Paper panel, one line per Review Label, each led by a Kesa Blush seat with the icon of what was reviewed (Languages for language, HandHeart for cultural, MessageCircle for opinion, Tag otherwise). Never a tick, a check or a seal.

### Notices and help
- **Not open yet:** a Sand plate beside a clock seat, said plainly.
- **"What's this?":** a native disclosure styled as an underlined link; its body is a Sand plate.

### Inputs / Fields
- **Style:** Paper, 1px Ink edge, 14px, 52px tall, Jost at body size. Labels 600 above.
- **Error:** a 2px Kesa Deep edge.
- **Forms:** an intro on a Sand mat beside the fields on a white 28px cushion.

### Navigation
- **Header:** Shell with a Line rule; mark and wordmark left, six area links (icon in Kesa Deep plus name) as 44px pills that hover Sand, the current one Ink with a Voivoi icon; a Paper search pill with an inset Line edge at the end.
- **Footer:** the woven strip, then an Ink field in four short columns; Shell links underlined in Voivoi, turning Voivoi on hover.

### Video without a still
When a video has no poster, it shows a drawn one: an Ink Deep frame in the footage's own shape with a Voivoi play seat and an Ink triangle, as a `data:` SVG. Video is never cropped and never taller than 80vh.

### Staff progress steps
On a staff piece, where it stands is three Shell steps (16px corners), each with a round mark and words: done is Ink with a Voivoi icon, now is Voivoi Cream, live is Green with a white icon on a Green Wash step.

## Do's and Don'ts

### Do:
- **Do** put one Lucide line icon (1.75 stroke) beside every area, kind, fact, form, stage and action, with its word, `aria-hidden`.
- **Do** seat icons on round tints; use the area's tone pair from the Area Tone Rule.
- **Do** give Review Labels the icon of what was reviewed.
- **Do** put small text on a Shell plate whenever the ground is Kesa.
- **Do** lift cushions 2px with the Lift shadow, swell the seat to 1.06 and step the arrow, and remove all of it under reduced motion.
- **Do** use the woven strip only as a hem (welcome mat, footer) and the woven N mark as the only emblem.
- **Do** keep targets at least 44px and buttons and fields at 52px.
- **Do** use native `<details>` for menus and help; public pages ship no client JavaScript and no inline styles.

### Don't:
- **Don't** let an icon stand in for a word, or use a glyph or emoji where a Lucide icon belongs.
- **Don't** use a tick, check, seal or shield on anything public that describes review; no generic "verified" badge.
- **Don't** set small text on Kesa, or use Kesa for small text (use Kesa Deep).
- **Don't** use green on the public site.
- **Don't** set uppercase or tracked labels, or an eyebrow line above a heading.
- **Don't** put shadows on Sand mats, notices or plates.
- **Don't** return to a photo hero over image cards, or to the tile mosaic this world replaced.
- **Don't** invent cultural imagery; placeholders are labelled as placeholders.
