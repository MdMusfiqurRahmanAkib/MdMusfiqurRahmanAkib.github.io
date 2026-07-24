# Academic Portfolio — IEEE Paper Format

A personal portfolio typeset to look and behave like an IEEE conference
manuscript: real two-column layout, automatic pagination into US-Letter
sheets, running heads, numbered sections, figures, tables, a reference
list with hover-preview citations, and an author-biography block.

Plain HTML, CSS and JavaScript — no build step, no dependencies, no Node.

---

## Preview locally

Python is the only thing needed (already installed on this machine):

```bash
python -m http.server 8123
```

Then open <http://localhost:8123>.

Opening `index.html` directly by double-clicking also works in most
browsers, but a local server is more reliable.

---

## Deploy free on GitHub Pages

1. Create a public repository named `<your-username>.github.io`.
2. Push these files to the `main` branch:

```bash
git init && git add . && git commit -m "Portfolio site"
```

3. In the repository: **Settings → Pages → Source: `main` / root**.
4. The site goes live at `https://<your-username>.github.io` in ~1 minute.

Netlify and Cloudflare Pages also work — drag the folder onto their
dashboard, no configuration required.

---

## File map

```
index.html               all content lives here, in the #source block
assets/css/paper.css     document typography (IEEE metrics, in em units)
assets/css/app.css       reader chrome, responsive rules, print stylesheet
assets/js/paginate.js    flows #source into fixed-size two-column sheets
assets/js/app.js         theme, zoom, outline, scroll-spy, citations
.claude/launch.json      local dev-server config
```

## How the layout works

Every measurement in `paper.css` is expressed in `em` relative to the
`--base` custom property, so changing one variable rescales the whole
sheet — that is what the zoom buttons do.

`paginate.js` moves the top-level blocks of `#source` one at a time into
a page body that has `column-fill: auto` and a fixed height. When a block
lands outside the content box the browser has pushed it into a phantom
third column, so the block is pulled back and a new sheet begins. CSS
multicol still breaks paragraphs across the two real columns, so text
flows exactly as it would in LaTeX.

Below 900 px viewport width the script switches to a single-column
continuous view instead — a paper sheet is unreadable on a phone.

## Editing content

All content is inside `<div id="source">` in `index.html`. Structure:

| Element | Purpose |
| --- | --- |
| `<h2 class="sec">` | Numbered section (I, II, III … assigned automatically) |
| `<h2 class="sec unnum">` | Unnumbered section (Acknowledgment, References) |
| `<h3 class="sub">` | Subsection (A, B, C … assigned automatically) |
| `<a class="cite" href="#ref1">[1]</a>` | Citation with hover preview |
| `<td class="lvl" data-lvl="4">` | Renders ●●●●○ |
| `class="ph"` | Marks placeholder text — see the sidebar toggle |

Do **not** hand-write section numbers; `paginate.js` inserts them.

## Paper formats

A toolbar toggle switches the whole document between two layouts, and the
choice is remembered per visitor:

- **IEEE** — two columns, Roman/alpha numbering (I, II … / A, B …).
- **Springer LNCS** — single column, Arabic numbering (1, 2 … / 1.1, 1.2 …),
  wider margins.

On first visit a one-time coach mark points at the toggle. On phones the
document keeps its real two-column (or single-column) paged sheets, scaled
to fit the screen, so it still reads as an actual research paper; open
**Book view** for comfortable page-by-page flipping.

## Interactive features (`assets/js/enhance.js`)

- **Book view** (open-book button, or `B`) — an immersive flip-book that
  turns pages like a real book: **drag a page corner or swipe** to turn,
  full touch support, a two-page spread on desktop and a single page on
  phones. Powered by the bundled, self-hosted StPageFlip engine
  (`assets/vendor/`, MIT) — no external CDN, so it still works offline and
  on free static hosting.
- **Page navigation** — the side arrows, or `←` / `→` (also
  `PageUp` / `PageDown`), move between pages in the scroll view.
- **Reader panel** (★ button, top right) — animated headline metrics,
  a five-star rating, and a note/idea box. "Send to author" opens the
  visitor's own email client addressed to you; "Save note" keeps it in
  that visitor's browser. Ratings and notes live in `localStorage`, so
  they are **per-device, not shared between visitors** — see below to
  make them public.
- **Command palette** — `Ctrl/⌘ + K` opens a searchable jump-to for every
  section and profile link.
- **Cite this portfolio** — copies a ready `@misc` BibTeX entry.

### Making reviews public (optional)
The built-in review box is local to each visitor. To collect reviews that
everyone can see, wire the form to a free no-backend service such as
Formspree or a Google Form and point the "Send" button at it — ask and
this can be added.

## Zoom and printing

Zoom (`+` / `−` or the toolbar) scales the sheet like a real PDF viewer —
the layout never re-flows and the page count never changes. Printing
(`Ctrl + P`) resets that zoom and emits genuine one-sheet-per-page output;
choose "Letter" (or "Fit to page" for A4) and disable browser headers in
the print dialog for a clean PDF.

## Keyboard shortcuts

`B` book view · `←` / `→` page · `Ctrl/⌘ + K` command palette · `T` theme ·
`O` outline · `+` / `−` zoom · `Esc` close panels · `Ctrl + P` print / PDF.

## Cache-busting

Local CSS/JS are linked with a `?v=N` query. After editing any of them,
bump the number in `index.html` so browsers fetch the new file instead of
a cached copy.

## Placeholders

Open the outline sidebar and click **Highlight placeholders** to see
every piece of text that still needs replacing. See `CONTENT.md` for the
list of information to supply.

---

The document states in its colophon that it is a personal portfolio in
the style of an IEEE manuscript, not a published paper, and not
affiliated with or endorsed by the IEEE. Keep that line.
