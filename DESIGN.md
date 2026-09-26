---
name: VideoLearn
description: Biến slide bài giảng thành lời giảng đúng thời lượng
colors:
  cover: "#044a97"
  cover-deep: "#134B88"
  cover-foil: "#e6d9a8"
  paper: "#f5f7f2"
  paper-band: "#e9eee4"
  paper-edge: "#dfe6da"
  sheet: "#fbfcf9"
  rule: "#c9d6ca"
  rule-strong: "#93aa98"
  print: "#2c5a47"
  print-soft: "#557a69"
  ink: "#1b2559"
  ink-soft: "#4b5577"
  ink-faint: "#5c6482"
  pen: "#BE1E2D"
  pen-soft: "#f9e3e5"
  pen-line: "#eab4b9"
  pen-wash: "#fdf6f4"
  navy: "#134B88"
  navy-soft: "#e4ecf6"
  navy-line: "#b7cbe3"
  studio-primary: "#4f46e5"
  studio-primary-deep: "#4338ca"
  studio-ground: "#f8fafc"
  studio-surface: "#ffffff"
  studio-hairline: "#e2e8f0"
  studio-muted: "#64748b"
  studio-ink: "#0f172a"
typography:
  headline:
    fontFamily: "Be Vietnam Pro, Inter, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Be Vietnam Pro, Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "28px"
  entry-title:
    fontFamily: "Be Vietnam Pro, Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.375
  script:
    fontFamily: "Be Vietnam Pro, Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "28px"
  body:
    fontFamily: "Be Vietnam Pro, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  column-head:
    fontFamily: "Be Vietnam Pro, Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "20px"
  label:
    fontFamily: "Be Vietnam Pro, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  figure:
    fontFamily: "Be Vietnam Pro, Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  remark:
    fontFamily: "Patrick Hand, Be Vietnam Pro, cursive"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.375
  remark-heading:
    fontFamily: "Patrick Hand, Be Vietnam Pro, cursive"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1
  stamp:
    fontFamily: "Patrick Hand, Be Vietnam Pro, cursive"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  mono:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  studio-body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  xs: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  cell-y: "12px"
  md: "16px"
  row-rule: "44px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.cover-deep}"
  button-primary-disabled:
    backgroundColor: "{colors.rule-strong}"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-band}"
  cover-band:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.paper}"
    height: "56px"
  nav-item-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.cover}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  ledger-tab:
    backgroundColor: "{colors.paper-band}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 14px 8px"
  ledger-tab-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  ledger-table:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
  ledger-column-head:
    backgroundColor: "{colors.paper-band}"
    textColor: "{colors.print}"
    typography: "{typography.column-head}"
    padding: "10px 12px"
  grade-stamp:
    textColor: "{colors.print}"
    typography: "{typography.stamp}"
    rounded: "{rounded.full}"
    padding: "1.6px 9.6px"
  grade-stamp-fix:
    textColor: "{colors.pen}"
  remark-panel:
    backgroundColor: "{colors.pen-wash}"
    textColor: "{colors.pen}"
    rounded: "{rounded.md}"
  panel:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  input-text:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
  segmented-track:
    backgroundColor: "{colors.paper-band}"
    rounded: "{rounded.lg}"
    padding: "4px"
  segmented-option-selected:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  duration-toggle-selected:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.paper}"
    padding: "4px 10px"
  error-note:
    backgroundColor: "{colors.pen-soft}"
    textColor: "{colors.pen}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
---

# Design System: VideoLearn

## Overview

**Creative North Star: "Sổ đầu bài" (the class logbook)**

The lecturer and learner surfaces (`/`, `/lectures/new`, `/lectures/:id`) are a Vietnamese class logbook. A deep ledger-blue cover band (#044a97, matching the pitch deck) with foil lettering sits on top; below it is cool paper printed with thin green-gray rules. Every lecture is a ruled entry with its period number, date, minutes, the teacher's remark and a circled grade stamp. Entries are written in blue-black ink; the teacher's red pen appears only where something needs fixing. Status is the grade stamp, never a colored chip or a floating card.

The printed form is Be Vietnam Pro at a few steady sizes with tabular figures everywhere (the whole world sets `font-variant-numeric: tabular-nums`). The hand is Patrick Hand, and only for what a teacher would write by hand: remarks, the "Lời phê" heading, grade stamps and the cover monogram. Tables are real ruled tables with printed column heads, vertical cell rules and a heavier rule under the header, like the pre-printed page.

Depth is paper-flat: pages rest on the ground with a hairline edge and one long, faint blue-tinted drop under the ledger sheet. The one signature motion is the stamp press: when a lecture has just been generated or re-checked, its grade stamp presses onto the entry once.

**Scope.** This world is route-scoped by the `ledger-world` class on the app shell (`/` and `/lectures/*`). The Knowledge Inspector (`/knowledge`, the "Nâng cao" nav item) and `/admin` keep the older studio look (see the legacy note below). The cover band is shared by every route.

**Key Characteristics:**
- Ledger-blue cover band (56px, 4px cover-deep bottom rule) with foil wordmark over paper ground.
- Ruled tables: printed 13px column heads in print green on paper-band, 1px rule cell dividers, a 2px print rule under the header.
- Blue-black ink for entries; red pen only for remarks, warnings and errors that need fixing.
- Circled, rotated (-5deg) Patrick Hand grade stamps as the only status marker.
- Be Vietnam Pro everywhere else; tabular figures in every time, count and score.

### Nâng cao & quản trị (retoned 2026-09-25)
The studio, Knowledge Inspector and admin surfaces now use the same logbook tokens (cover band, paper ground, ink text, print/pen/navy accents, Be Vietnam Pro). They stay denser than the lecturer flow (11–12px meta in tables and inspectors) and keep the six-hue pedagogical role and pause-tag vocabulary (`badge-role-*`, `pause-tag-*`) because those hues carry meaning. Dark panels inside the studio use cover / cover-deep as solid fills with paper or foil text; nothing is translucent except region overlays drawn over a page image.

## Colors

A cool, printed palette: a blue cover for the book, green for its printing, blue-black for what is written, one red pen for correction.

### Primary
- **Ledger Cover** (cover): the cover band, every primary action ("Ghi bài mới", "Quét tài liệu", "Tạo bài giảng", "Lưu & kiểm tra lại", the main download), the active step dot, the selected total-duration toggle, the scan progress fill.
- **Deep Cover** (cover-deep): primary hover, the cover band's 4px bottom rule, the avatar fallback disc.
- **Cover Foil** (cover-foil): wordmark, monogram and model-chip icon on the cover band, and the cover band's focus ring. Foil lives only on the cover.

### Secondary
- **Print Green** (print): pre-printed parts of the form: column heads, the heavy header rule (at 60%), completed step dots, tick bars in the time column, text links and the hover action under a stamp, checkbox and slider accent, focus outline inside the world, and "good" grade stamps (Tốt, Khá, Đạt). Also time that was added in a calibration preview.
- **Soft Print** (print-soft): hover border on drop zones and file pickers.

### Accents (user decision, 2026-09-25)
- **Accent Navy** (navy, #134B88): emphasis that is not a correction: text links and secondary actions, the active step dot, the selected ledger tab (2px top edge + label), result figures in the stat grid and big KPI numbers, time-share and keyword-weight bars, time added in a calibration preview, the "+10s" note on the lesson plan.
- **Accent Crimson** (pen, #BE1E2D): the teacher's red pen, see below. The pen token was moved to this exact value.

### Tertiary
- **Teacher's Red Pen** (pen): red remarks on entries that need fixing, the "Cần sửa" stamp, the "Lời phê" panel, focus keywords, failing-figure notes, error text, the attention tab count.
- **Pen Wash / Pen Line / Pen Soft** (pen-wash, pen-line, pen-soft): the Lời phê panel ground and its rules; pen-soft fills inline error notes and tints flagged script rows (at 40%).

### Neutral
- **Paper** (paper): page ground inside the world and the ledger sheet; also the text color on the cover band and on cover-filled buttons.
- **Paper Band** (paper-band): printed header rows, inactive ledger tabs, segmented tracks, hover fill on rows and quiet buttons, the busy status strip.
- **Paper Edge** (paper-edge): the printed row ruling (`ledger-ruled`, one line every 44px) and the 1px under-edge of the ledger sheet.
- **Sheet** (sheet): the slightly whiter writing surface for panels, inputs, secondary buttons, stat cells, the lesson-plan table and the script ledger.
- **Rule / Rule Strong** (rule, rule-strong): cell rules and dividers (rule); sheet borders, chapter rows, active tab edge and disabled primary fill (rule-strong).
- **Ink / Ink Soft / Ink Faint** (ink, ink-soft, ink-faint): blue-black entries and headings; secondary text, pending remarks and the "Chờ duyệt" stamp; period numbers, meta, placeholders, the "Mới" stamp.

### Named Rules
**The Red Pen Rule.** Pen red marks only what needs fixing: a red remark, the "Cần sửa" stamp, the Lời phê panel, a warning note, an error. It never decorates, and it never marks something that is fine.

**The Foil Stays On The Cover Rule.** Cover foil appears only on the cover band. On paper, emphasis is ink weight or print green.

**The Stamp Is The Status Rule.** A lecture's status is its grade stamp (print for graded, pen for Cần sửa, ink-soft for Chờ duyệt, ink-faint for Mới). No colored chips, pills or card fills for status.

## Typography

**Display Font:** none; page titles are the printed form at 28px semibold.
**Body Font:** Be Vietnam Pro (with Inter, system-ui, sans-serif)
**Hand Font:** Patrick Hand (with Be Vietnam Pro, cursive), for remarks and stamps only
**Mono Font:** JetBrains Mono, for the model id on the cover band only

**Character:** a Vietnamese-native printed sans doing the form at steady sizes, against one plain handwriting face for what the teacher writes. Tabular figures throughout.

### Hierarchy
- **Headline** (600, 1.75rem / 28px, leading-tight): one page title per view ("Sổ bài giảng", "Ghi bài mới", a lecture's title).
- **Title** (600, 18px, 28px): section heads inside a lecture ("Giáo án: cấu trúc & thời lượng").
- **Entry Title** (600, 15px): lecture titles in the ledger, one line on desktop.
- **Script** (400, 15px, 28px): narration text in the Giờ / Lời giảng ledger and its editor, capped at 68-72ch.
- **Body** (400-600, 14px, 20px): descriptions, form labels, table cells, buttons, tabs, panel headings.
- **Column Head** (600, 13px, print green): printed column heads of every ruled table.
- **Label** (400-500, 12px, 16px): meta under entries, hints, dt labels, stat notes, footer.
- **Figure** (600, 24px, tabular, -0.025em): measured results in the stat grid.
- **Remark** (Patrick Hand, 15-20px): handwritten remarks: 17px in the ledger table, 16px on mobile entries, 15px for the rebalance note beside a page row, 20px for the empty-ledger line.
- **Remark Heading** (Patrick Hand, 24px, leading-none): the "Lời phê" panel heading.
- **Stamp** (Patrick Hand, 1.05rem / ~17px, 24px line; 18px on the lecture page header): grade stamps. The cover monogram "V" is Patrick Hand 18px in foil.

### Named Rules
**The Two Hands Rule.** Be Vietnam Pro is the printed form; Patrick Hand is the teacher's pen. Patrick Hand appears only for remarks, the Lời phê heading, stamps and the monogram, between 15px and 24px, never for labels, buttons, headings or body.

**The Tabular Figures Rule.** Every time, count, page, score and token figure is tabular; the world sets it globally, and time columns align right.

**The Sentence Case Rule.** Column heads, tabs, labels and buttons are Vietnamese sentence case, never uppercase-tracked.

## Layout

The shell is a sticky 56px cover band, a centered container (max 1280px, 16/24/32px side padding at base/sm/lg, 24px vertical, 32px from lg) and a 1px rule footer in 12px ink-faint.

The home is one full-width ledger sheet: a heading row (title and one-line count summary left, the primary action right, bottom-aligned), ledger-edge tabs sitting on the sheet's top edge (the sheet's top-left corner is square where the tabs attach), then the ruled table. Columns: Tiết (56px, centered) · Ngày (80px) · Tên bài (fluid) · Thời lượng (128px, right-aligned) · Nhận xét (fluid) · Xếp loại (144px, centered). Rows needing action sort first. Below md the table becomes a divided list of entries: title and stamp on one row, meta beneath, the remark full width.

A lecture page is a two-column grid from lg: main column plus a 280px sticky aside (Thiết lập, Nâng cao links), 32px gap. The main column stacks the back link, title with stamp, the step row, then either the calibration panel + lesson-plan table + sticky bottom action bar, or the stat grid, Lời phê panel, download row and script ledger. The script ledger is an 88px time column beside the text.

Focused tasks (new lecture) narrow to a 672px single column with 32px between groups and 24px between fields. Table cells pad 12px vertically; the rhythm follows 4 / 8 / 12 / 16 / 24 / 32px, with 44px printed row ruling on empty states.

## Elevation & Depth

Paper-flat. Surfaces are separated by rules and the sheet-on-paper contrast; the few shadows are blue-tinted and long, like a page lying on a desk.

### Shadow Vocabulary
- **Ledger sheet** (`box-shadow: 0 1px 0 #dfe6da, 0 12px 28px -20px rgba(19,75,136,0.45)`): the home ledger sheet only.
- **Cover press** (`box-shadow: 0 1px 2px rgba(19,75,136,0.35)`): the page-level primary action on the home heading row.
- **Floating bar** (`box-shadow: 0 8px 24px -12px rgba(15,23,42,0.25)`): the sticky generate bar at the bottom of the lesson-plan review, over sheet at 95% with backdrop blur.
- **Selected option** (`box-shadow: 0 1px 2px rgba(15,23,42,0.08)`): the selected segmented option.

### Named Rules
**The Paper Rests Rule.** Nothing floats at rest except the ledger sheet's long faint drop. Stronger shadows are only for sticky bars that ride over content.

## Shapes

Printed, lightly rounded. Ruled tables, the ledger sheet, ledger tabs (top corners only), the Lời phê panel and nav items use 8px; buttons, inputs, segmented tracks, error notes and file pickers use 12px; panels, the stat grid, drop zones, the calibration panel and the sticky bars use 16px. Stamps, step dots, avatars and progress tracks are round. Tick bars are 2px-rounded. Borders are 1px rule for dividers and panels, 1px rule-strong for sheets and interactive fields, 2px print at 60% under table headers, dashed 2px rule-strong for the drop zone and dashed 1px for file pickers.

## Components

### Buttons
Plain and printed; the cover blue says which one matters.
- **Shape:** 12px radius.
- **Primary:** cover fill, paper/white 14px semibold label, 10px 20px (8px 16px in compact spots), optional 16px leading icon or spinner. One per view or action row.
- **Hover / Focus:** fill deepens to cover-deep; focus-visible draws a 2px print outline or ring with 2px offset. Disabled goes to rule-strong fill with a not-allowed cursor (or 50% opacity inside the Lời phê panel).
- **Secondary:** sheet fill, 1px rule-strong border, ink-soft 14px medium, 8px 14px; hover paper-band.
- **Text link:** print green 14px semibold with a trailing arrow; hover to cover.
- **Icon button:** 6-8px padding, ink-faint icon, 8px radius; hover paper-band fill and print or ink icon.

### Ledger Tabs
Filter tabs that look like the tabbed edge of the book: 8px top corners, no bottom border, 14px. Inactive: paper-band, ink-soft, transparent border. Active: paper fill, rule-strong edge, semibold ink, raised to merge with the sheet. Each carries a tabular count in ink-faint, or pen when it is the Cần sửa count and non-zero. Exposes `role="tab"` and `aria-selected`.

### Ruled Table (signature)
Paper or sheet ground inside an 8px rule-strong frame. Header row: paper-band, 13px semibold print, 2px print/60 bottom rule, 1px rule vertical dividers. Body rows: 1px rule bottom, 1px rule vertical dividers, 12px vertical cell padding, hover paper-band at 70%. Numbers are tabular; the period column is ink-faint and centered. In the lesson plan, chapter rows sit on paper-band at 50% with a rule-strong bottom; excluded rows go ink-faint with a line-through; the Tỉ trọng column draws a print tick bar (`ledger-ticks`, one tick per 10s) whose width tracks the page's time; the Thời lượng cell is a ±10s stepper around the tabular clock.

### Grade Stamp (signature)
A circled, handwritten mark: 2px currentColor border, full radius, Patrick Hand 1.05rem, min-width 72px, rotated -5deg at 92% opacity. Tone is the status (print, pen, ink-soft, ink-faint). **Stamp press:** when a lecture was just generated or re-checked, the stamp animates in once from scale 1.7 / -16deg / blurred to rest (0.55s, `cubic-bezier(0.16,1,0.3,1)`, 0.25s delay); disabled under reduced motion.

### Lời phê Panel (signature)
The teacher's correction sheet: pen-wash ground, 1px pen-line border and rules, 8px radius. Heading is "Lời phê" in Patrick Hand 24px pen beside a 14px pen/80 count line. Each item: 14px semibold ink title with a 12px pen severity word, 14px ink-soft why and how-to list, scene jump buttons (sheet, print text, pen-line ring, 6px radius), and fix actions (one cover primary, the rest secondary).

### Script Ledger
The generated narration as a ruled two-column ledger: header "Giờ · Lời giảng" in the printed column-head style; each row has the tabular start time (14px medium ink) over the scene length (12px ink-faint) and listen / edit icon buttons, then the 12px topic and 15px/28px script. Flagged rows tint pen-soft at 40% and add a pen "· cần xem lại".

### Stat Grid
A 16px clipped frame with 1px rule gaps: sheet cells with a 12px ink-faint label, a 24px semibold tabular figure (target shown lighter after a slash) and a 12px note, pen and medium when it warns. Shows "—" before a measured value exists.

### Cards / Containers
- **Corner Style:** 16px for panels; 8px for tables and the Lời phê panel.
- **Background:** sheet on paper.
- **Shadow Strategy:** none at rest (see Elevation & Depth).
- **Border:** 1px rule; 1px rule-strong for table frames.
- **Internal Padding:** 16px; 12px 16px for single-line strips.

### Inputs / Fields
- **Style:** sheet fill, 1px rule-strong border, 12px radius, 10px 14px, 14px ink, ink-faint placeholder; label above in 14px medium ink with an optional 12px ink-faint hint.
- **Focus:** border turns print with a 2px print ring at 20%; caret is ink.
- **Checkboxes and sliders:** print accent.
- **Segmented control:** paper-band track, 4px padding, 12px radius; options 14px ink-soft; selected option is a sheet 8px pill in semibold ink; exposes `aria-pressed`.
- **Total-duration toggle:** a joined row of minute options in a rule-strong 8px frame with rule dividers; the selected option is cover with paper text.
- **Error:** pen-soft note with pen text, 12px radius.

### Navigation (cover band)
Sticky, 56px, cover fill with a 4px cover-deep bottom rule. Left: a 32px foil-outlined monogram (Patrick Hand "V") and the 15px semibold foil wordmark with slight tracking. Items are 14px medium with a 16px icon, paper at 80%; hover white/10 fill; active is a paper pill with cover text (8px radius); labels hide below sm. Right: the model chip (white/20 outline, foil icon, 12px provider name, mono model id), then avatar, name from lg and an icon-only sign-out behind a white/15 left rule.

### Steps
Four numbered 24px dots joined by 24px rule-strong lines: done is print with a check, active is cover with semibold ink label, upcoming is rule with ink-faint. Exposes `aria-current="step"`.

## Do's and Don'ts

### Do:
- **Do** tell a lecture's status only with its grade stamp: print for graded, pen for Cần sửa, ink-soft for Chờ duyệt, ink-faint for Mới.
- **Do** present lists of lectures, pages and scenes as ruled tables with 13px semibold print column heads, 1px rule cell dividers and a 2px print/60 rule under the header.
- **Do** give each view or action row exactly one cover-green primary action; the rest are secondary or text.
- **Do** set Patrick Hand only for remarks, the Lời phê heading, stamps and the monogram, between 15px and 24px.
- **Do** use tabular figures for every time, count and score, and show "—" when no measured value exists.
- **Do** keep text a user must read at 12px or above: 28px titles, 18px section heads, 15px entry titles and script, 14px body, 13px column heads, 12px meta.
- **Do** honor reduced motion for the stamp press.
- **Do** keep the studio, Knowledge Inspector and admin routes on the legacy studio look.

### Don't:
- **Don't** use pen red for anything that is not a correction, warning or error.
- **Don't** put colored status chips, pills or card fills on entries; the stamp is the status.
- **Don't** use cover foil off the cover band.
- **Don't** use Patrick Hand for buttons, labels, headings, column heads or body copy.
- **Don't** add uppercase tracked labels (kickers or eyebrows) above headings.
- **Don't** bring studio indigo, slate cards or the role-hue badges onto logbook routes, or ledger green onto studio routes.
