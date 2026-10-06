---
name: NAISEMA
description: Woven mat. Everything NAISEMA offers laid out as tiles in the weave of its own mark, on the NAISEMA brand.
colors:
  ink: "#0f2b35"
  ink-deep: "#0a1d24"
  ink-2: "#1b3f4c"
  kesa: "#d2603f"
  kesa-deep: "#a9472a"
  voivoi: "#e9be5b"
  voivoi-light: "#f1cd78"
  shell: "#f6f5f2"
  sand: "#e8e5de"
  paper: "#ffffff"
  line: "#d6d2c8"
  muted: "#56686e"
  mist: "#a9bcc2"
  shell-dim: "#d5dfe2"
  kesa-strand: "#b95334"
  voivoi-strand: "#ddad45"
  ink-2-strand: "#24505f"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(3.1rem, 2rem + 5vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 1.7rem + 3.6vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  tile-name:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "2.4rem"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 1.25rem + 1vw, 2rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  title-small:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  wordmark:
    fontFamily: "Bricolage Grotesque Variable, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.05em"
  lede:
    fontFamily: "Jost Variable, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Jost Variable, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  body-reading:
    fontFamily: "Jost Variable, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Jost Variable, Century Gothic, Avenir Next, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.65
    letterSpacing: "0.12em"
rounded:
  strand: "2px"
  input: "8px"
  plate: "10px"
  tile: "18px"
  pill: "999px"
spacing:
  strand-inset: "clamp(0.35rem, 0.2rem + 0.5vw, 0.7rem)"
  weave-gap: "clamp(0.6rem, 0.4rem + 0.8vw, 1rem)"
  gutter: "clamp(1rem, 0.6rem + 2vw, 3.5rem)"
  plate-pad: "0.9rem 1.1rem"
  tile-pad: "clamp(1.25rem, 0.9rem + 1.4vw, 2rem)"
  head-pad: "clamp(1.4rem, 1rem + 2vw, 2.5rem)"
  welcome-pad: "clamp(1.6rem, 1rem + 3vw, 3.25rem)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell}"
    typography: "{typography.body}"
    rounded: "{rounded.plate}"
    padding: "0.8rem 1.6rem"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.shell}"
  button-on-ink:
    backgroundColor: "{colors.voivoi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "0.8rem 1.6rem"
    height: "48px"
  button-on-ink-hover:
    backgroundColor: "{colors.voivoi-light}"
    textColor: "{colors.ink}"
  button-form:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.input}"
    padding: "0 1.6rem"
    height: "44px"
  button-form-hover:
    backgroundColor: "{colors.ink-deep}"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.input}"
    padding: "0.55rem 0.75rem"
    height: "44px"
  menu-toggle:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.1rem"
    height: "44px"
  menu-toggle-open:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell}"
  tile-welcome:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell}"
    rounded: "{rounded.tile}"
    padding: "{spacing.welcome-pad}"
  tile-learn:
    backgroundColor: "{colors.kesa}"
    textColor: "{colors.ink}"
    typography: "{typography.tile-name}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  tile-voices:
    backgroundColor: "{colors.voivoi}"
    textColor: "{colors.ink}"
    typography: "{typography.tile-name}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  tile-ezine:
    backgroundColor: "{colors.voivoi}"
    textColor: "{colors.ink}"
    typography: "{typography.tile-name}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  tile-discover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.tile-name}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  tile-connect:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.shell}"
    typography: "{typography.tile-name}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  tile-resources:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.shell}"
    typography: "{typography.tile-name}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  tile-quiet:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  tile-updates:
    backgroundColor: "{colors.voivoi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  head-tile:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.tile}"
    padding: "{spacing.head-pad}"
  shell-plate:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "0.75rem 0.9rem"
  sand-plate:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "{spacing.plate-pad}"
  nav-link:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "0.4rem 0"
---

# Design System: NAISEMA

## Overview

**Creative North Star: "The Woven Mat"**

The public site is an ibe, a woven mat. Everything NAISEMA offers is laid out as rounded tiles set in the weave of its own mark: each tile is a strand, alternately upright and sideways, and the alternation stays visible at every width. The brand is the material. Ink, Kesa, Voivoi and Shell are the four colours of the woven N, Sand and Ink-2 are the quiet strands between them, and the mark's own 11 by 15 strand shape is reused as fact bullets, the sign-off strand, the masked weave inside tall tiles and the woven strip that runs above the Ink footer.

Density is generous and flat. Tiles rest on a Shell ground with a narrow weave gap between them, carry one heavy Bricolage Grotesque name each, and let any slack fill with their own strands rather than an empty field. Reading pages are calm: a coloured head tile, then Jost on Shell at a 66ch measure, with facts and Review Labels set as flat lines led by woven strands, never as badges. The system refuses the category default of a photo hero over a grid of image cards, and the identity is binding: the woven N mark, the four brand colours and the Bricolage and Jost pairing are fixed by the NAISEMA brand.

Motion is one gesture: a tile pulls taut under the pointer or keyboard focus, its inset relaxing to flush as it lifts. Everything works without JavaScript and without inline styles; colour reaches the mark and the strands through custom properties and classes only.

**Key Characteristics:**
- Rounded tiles (18px) in the four brand colours plus Sand, white and Ink-2, on a Shell ground.
- Every tile alternates upright and sideways: an inset on phones, the strands' own shapes on tablets and desktops.
- One colour per area, shared by its homepage tile and its pages' head tile.
- Bricolage Grotesque ExtraBold speaks; Jost is read.
- Woven-strand bullets, masked strand bands and the woven strip carry the mark's geometry through the whole site.
- Flat at rest; soft lift only as a response to the pointer.

## Colors

The NAISEMA brand palette, used as solid fields: deep teal Ink, burnt-orange Kesa and golden Voivoi on an off-white Shell, with Sand and Ink-2 as the quiet tiles.

### Primary
- **Ink** (#0f2b35): the brand's deep teal. All body text and headings on light grounds, the welcome tile, the Connect tile, the footer field, primary buttons, form borders, the open menu toggle and the N strands of the mark on light grounds.
- **Ink Deep** (#0a1d24): hover state of every Ink button, and the letterbox behind video.

### Secondary
- **Kesa** (#d2603f): the brand's burnt orange. The Learn tile and Learn head, link underlines, the current-page nav rule, odd fact-line bullets, the sign-off strand and the ground strands of the mark. Ink on Kesa reaches only 3.87:1, so Kesa carries display type and nothing smaller.
- **Kesa Deep** (#a9472a): Kesa deepened for small text (5.3:1 on Shell, 4.6:1 on Sand). Uppercase labels, list markers, field errors, the invalid-field border, disclosure lines, the form alert edge and the default focus ring.
- **Kesa Strand** (#b95334): the strands woven into the Learn tile's slack.

### Tertiary
- **Voivoi** (#e9be5b): the brand's gold. Voices and E-zine tiles and heads (shared), the Updates tile, the welcome button, nav hover rule, footer link underlines, text selection, the playing transcript line, blockquote edges and the focus ring on Ink grounds.
- **Voivoi Light** (#f1cd78): hover state of the Voivoi button on Ink.
- **Voivoi Strand** (#ddad45): the strands in Voices and E-zine slack.

### Neutral
- **Shell** (#f6f5f2): the page ground, the header, the plate small text rides on Kesa, and text on Ink and Ink-2.
- **Sand** (#e8e5de): quiet tiles (Recently published, Ways to take part), the default head tile, callouts, the not-open plate, notice wording, Discover's strands.
- **Paper** (#ffffff): the Discover tile and head (with a 2px Line edge), form fields, blockquotes and embedded items.
- **Ink-2** (#1b3f4c): the Resources tile and head, and the strands woven into the welcome and Connect tiles.
- **Ink-2 Strand** (#24505f): the strands in the Resources tile.
- **Line** (#d6d2c8): 1px rules (header base, piece lists, review labels, form consents, page foot) and the 2px inset edge of white tiles.
- **Muted** (#56686e): secondary text on light grounds: datelines, list marks, hints, sources, optional markers, breadcrumb current page.
- **Mist** (#a9bcc2): secondary text on Ink: the sign-off name, the welcome dateline, the footer note.
- **Shell Dim** (#d5dfe2): the welcome statement on Ink.

### Named Rules
**The Shell Plate Rule.** Small text never sits on Kesa. On a Kesa tile anything smaller than the tile name rides a Shell plate (10px radius) in Ink, with Kesa Deep for its label; on a Kesa head tile only the heading sits on the colour.

**The One Colour Per Area Rule.** Each area owns one tile colour, shared by its homepage tile and the head tile of its pages: Learn Kesa, Voices and E-zine Voivoi, Discover white with a Line edge, Connect Ink, Resources Ink-2. A page without an area takes a Sand head.

**The Deep For Small Rule.** Kesa fills, underlines and bullets; Kesa Deep is the only orange for text below display size, for errors and for the focus ring on light grounds.

## Typography

**Display Font:** Bricolage Grotesque Variable (with Arial Narrow, system-ui), self-hosted via @fontsource-variable
**Body Font:** Jost Variable (with Century Gothic, Avenir Next, system-ui), self-hosted via @fontsource-variable

**Character:** Bricolage Grotesque speaks, Jost is read. A heavy, slightly quirky grotesque at very tight leading for names and headings, against a clean geometric sans for everything a visitor reads, labels and buttons included.

### Hierarchy
- **Display** (800, clamp(3.1rem, 2rem + 5vw, 6rem), 0.88, -0.035em): the welcome greeting on the Ink tile only, held to 6ch so it stacks.
- **Headline** (800, clamp(2.5rem, 1.7rem + 3.6vw, 4.5rem), 0.95, -0.025em): every page h1, set inside its head tile.
- **Tile Name** (800, 2.4rem; 2rem inside the desktop mat, 0.92, -0.025em): the area name on each homepage tile.
- **Title** (700, clamp(1.5rem, 1.25rem + 1vw, 2rem), 1): h2 section headings and quiet-tile headings.
- **Title Small** (700, 1.3rem, 1.2): h3, piece titles in ruled lists, panel headings inside Sand tiles.
- **Wordmark** (Bricolage 700, 1.5rem, 0.05em tracking): NAISEMA beside the mark in header (1.2rem at 24rem and below) and footer (1.3rem).
- **Lede** (Jost 400, 1.3rem, 1.5, max 40rem): the summary under a head tile.
- **Body** (Jost 400, 1.0625rem, 1.65): the site default, tile text (1.45 leading), nav links (500).
- **Body Reading** (Jost 400, 1.125rem, 1.75, 66ch measure): Article bodies; headings get less space below than above.
- **Label** (Jost 600, 0.8125rem, 0.10 to 0.14em tracking, uppercase): field and fact labels (From, Topics, Review Labels, definition terms, search filter legends), datelines, list marks and tile notes, in Kesa Deep or Muted.

### Named Rules
**The Speaks And Reads Rule.** Bricolage Grotesque is for headings, tile names, the wordmark and piece titles; Jost is for everything read, including form labels, buttons, labels and facts. No system display face stands in for Bricolage.

**The Label Names A Fact Rule.** The uppercase tracked label names the field or fact it sits beside (From, Topics, Review Labels, Published, a format). It never floats above a heading as decoration.

## Layout

The page column is 80rem inside one fluid gutter (clamp(1rem, 0.6rem + 2vw, 3.5rem)), shared edge to edge by header, main and footer. Reading panes are 48rem (42rem narrow) and centred; the Article body holds a 66ch measure.

The homepage is the mat: a grid of tiles with a weave gap of clamp(0.6rem, 0.4rem + 0.8vw, 1rem).
- **Desktop (80rem and up):** five columns. The Ink welcome spans two; the six areas span three, in a four-track grid (1.7fr 1fr 1fr 1.7fr) laid in the strands' own shapes: Learn and Voices sideways across the head, two tracks wide; Discover and Connect upright at either edge, two rows tall; E-zine and Resources sideways between them. Recently published spans three columns and two rows beneath the welcome; Ways to take part and Updates stack beside it.
- **Tablet and laptop (40 to 80rem):** two columns. Learn crosses the head; Voices, E-zine and Resources stand upright, two rows tall; Discover and Connect lie sideways. The left column reads before the right, in area order.
- **Phones (below 40rem):** one column. The weave survives as an inset: alternate tiles are inset sideways or upright by clamp(0.35rem, 0.2rem + 0.5vw, 0.7rem).

The header nav becomes a native disclosure menu at 56rem and below; the wordmark and menu tighten at 24rem so 320px and 200% zoom fit one row. Definition lists stack at 34rem; search filters and fact grids stack at 40rem.

### Named Rules
**The Weave Rule.** Area tiles alternate upright and sideways at every width: by shape (two rows tall or two tracks wide) where the grid allows, by an upright or sideways inset where it does not.

**The Strand Band Rule.** A tall tile never shows an empty field: the slack between its heading and its words fills with its own strands, a 36px masked weave repeat tinted per tile, never shorter than one whole repeat and repeating whole strands only. It is decorative and appears only where tiles are tall (the welcome, Discover and Connect on desktop; Voices, E-zine and Resources on tablet).

## Elevation & Depth

The mat is flat. Tiles are solid colour fields separated by the weave gap; white tiles and plates take a 2px inset edge instead of a border. Depth appears only as lift in response to the pointer, plus a soft drop beneath the open phone menu and the primary button.

### Shadow Vocabulary
- **Tile lift** (`box-shadow: 0 18px 30px -18px rgb(10 29 36 / 0.55)` with `translateY(-2px)`): an area tile under hover or keyboard focus.
- **Button rest** (`box-shadow: 0 8px 18px -12px rgb(10 29 36 / 0.7)`): the primary link button; it rises 1px on hover.
- **Menu drop** (`box-shadow: 0 16px 32px -20px rgb(15 43 53 / 0.45)`): the open phone menu panel under the header.
- **Inset edge** (`box-shadow: inset 0 0 0 2px <colour>`): Line on white tiles and embedded items, Voivoi on blockquotes, Kesa Deep on form alerts.

### Named Rules
**The Flat Mat Rule.** Tiles rest flat. Shadows are soft, Ink-tinted and negative-spread, and they mean lift; there are no hard offset shadows.

## Shapes

Everything is rounded like the mark's strands, in three steps: tiles and head tiles at 18px, plates (Shell plate, Sand plate, callouts, blockquotes, images, primary buttons) at 10px, form fields and form buttons at 8px. The strand itself (11 by 15, 1.6 radius in a 100-unit mark) recurs at 2px radius as the fact-line bullets and sign-off strand, alternating upright (Kesa, 0.5 by 0.7rem) and sideways (Ink, 0.7 by 0.5rem). The menu toggle is the one pill (999px). Ruled 1px Line rules are the only unrounded divisions: piece lists, review labels, consents, page feet.

### Named Rules
**The Strand Corner Rule.** Three radii only: 18px for tiles, 10px for plates and buttons, 8px for fields. A container never has square corners.

## Components

### Buttons
Solid, heavy-thumbed and plain.
- **Shape:** gently rounded (10px) for link buttons, 8px for form buttons; at least 48px (link) or 44px (form) tall.
- **Primary:** Ink with Shell text, Jost 600 at 1.0625rem, 0.8rem 1.6rem padding, resting on the button shadow.
- **Hover / Focus:** Ink Deep and a 1px rise over 200ms; focus is the site ring (3px Kesa Deep, 3px offset).
- **On Ink:** inside the welcome tile the button turns Voivoi with Ink text, hovering to Voivoi Light; focus rings on Ink grounds are Voivoi.
- **Form:** Ink with white text, 8px, 0 1.6rem padding; disabled at 60% opacity.

### Area Tiles (signature)
- **Corner Style:** 18px.
- **Background:** the area's colour (see The One Colour Per Area Rule); white tiles carry a 2px Line inset edge.
- **Content:** the area name in Tile Name, then the description in Body (max 22rem), with an uppercase "not open yet" label when parts are closed. On Learn the text rides a Shell plate.
- **Hover / Focus, "pulls taut":** the tile's upright or sideways inset relaxes to flush, it rises 2px and takes the tile lift shadow, over 320ms on the ease-out curve (cubic-bezier(0.16, 1, 0.3, 1)). Focus outline is Ink. Under reduced motion the transition and the rise are removed.

### Welcome Tile
Ink, padded wider (clamp(1.6rem, 1rem + 3vw, 3.25rem)). Display greeting at top left, the mark large at top right (Shell N strands on Kesa ground, 4.5 to 8.5rem), the statement in Shell Dim, the Voivoi button, then the strand band, then a quiet sign-off (a Kesa strand and NAISEMA in Mist) and the dateline.

### Head Tiles
Every page opens on a tile. An Article or area page's head takes its area colour with only the h1 on it; the lede, byline and facts follow on Shell. Any page whose h1 opens bare (forms, info pages, errors) gets the Sand head tile automatically. Padding clamp(1.4rem, 1rem + 2vw, 2.5rem), headline at 0.95 leading.

### Cards / Containers
- **Quiet tiles:** Sand (Recently published, Ways to take part) or Voivoi (Updates), 18px, tile padding.
- **Sand tiles for details:** Resource details and Episodes sit on Sand at 18px.
- **Plates:** 10px; Sand for callouts, not-open notices, notice wording and stage intros; white with an inset edge for blockquotes (Voivoi), embedded items (Line) and form alerts (Kesa Deep).

### Fact Lines
Flat lines, never badges. Jost 500 at 0.95rem with tabular numerals, each led by a woven strand: odd items a Kesa upright strand, even items an Ink sideways strand. Review Labels sit under their own Kesa Deep label, one per line, below a Line rule.

### Piece Lists
Ruled lines (1px Line top and bottom). Each title in Title Small (Bricolage 700) with no underline until hover (Kesa); then the summary in Body and a Muted uppercase list mark (area or format, then the date).

### Inputs / Fields
- **Style:** white field, 1px Ink border, 8px radius, 0.55rem 0.75rem padding, at least 44px tall; labels in Jost 600 at 0.95rem, hints Muted.
- **Focus:** the site focus ring.
- **Error:** 2px Kesa Deep border, a Kesa Deep message in Jost 600; a form-level alert is a white plate with a 2px Kesa Deep inset edge.
- **Choices:** 1.25rem checkboxes and radios in Ink accent; consents each their own box with the notice's words beside them.

### Navigation
- **Header:** Shell, 1px Line base. The woven mark (Ink N on Kesa ground, 2.6rem) and Bricolage wordmark at left; six areas and Search (set off by a Line divider) in Jost 500 at right.
- **States:** a 3px rule beneath the link, Voivoi on hover and Kesa for the current page (which also turns 600).
- **Mobile:** at 56rem and below, a native disclosure: an Ink-outlined pill toggle with three drawn strands, turning solid Ink when open; the panel drops beneath the header with links on Line rules.
- **Links:** Ink text with a 2px Kesa underline at 0.24em, thickening to 3px and tucking to 0.18em on hover over 160ms.
- **Breadcrumb:** 0.95rem, "/" separators and the current page in Muted.

### Woven Mark and Weave Strip
The mark is an N woven from 25 strands on a 5 by 5 weave, coloured by its ground through two custom properties: N strands (`--mark-n`) and ground strands (`--mark-ground`). Ink on Kesa on Shell; Shell on Kesa on Ink. The favicon is the mark on a Shell rounded square. Above the Ink footer runs the brand's woven strip, a 36px band of Ink, Kesa and Voivoi strands on Shell; the footer below is Ink with Shell links underlined in Voivoi.

## Do's and Don'ts

### Do:
- **Do** lay new surfaces out as tiles on the Shell ground: 18px corners, a weave gap between them, and the upright or sideways alternation visible at every width.
- **Do** give an area's pages its tile colour on the head tile, and a Sand head tile to any page without an area.
- **Do** put any text smaller than the tile name on a Shell plate when it sits on Kesa (The Shell Plate Rule).
- **Do** set facts and Review Labels as flat lines with woven-strand bullets (Kesa upright, Ink sideways, 2px radius).
- **Do** use Kesa Deep (#a9472a) for small orange text and the focus ring on light grounds, and switch the ring to Voivoi on Ink.
- **Do** fill the slack in tall tiles with their own masked strands, in whole 36px repeats only.
- **Do** keep buttons, menu links and form controls at least 44px tall, and give every hover a matching keyboard focus state.
- **Do** colour the woven mark only through `--mark-n` and `--mark-ground`.

### Don't:
- **Don't** set small text on Kesa: Ink on Kesa is 3.87:1, good only for display sizes.
- **Don't** turn facts, formats or Review Labels into badges, pills or chips, and never show a generic "verified" mark.
- **Don't** open a page with a photo hero over a grid of image cards.
- **Don't** redraw, recolour outside its two properties, or crop the woven mark or the woven strip; both are approved brand artwork.
- **Don't** use glyph icons; draw the device from strands, as the menu toggle does.
- **Don't** float an uppercase label above a heading as a kicker; a label names the fact beside it.
- **Don't** give a container square corners or a hard offset shadow; ruled 1px Line rules are the only unrounded division.
- **Don't** use inline styles; colour and geometry reach components through classes and custom properties only.
