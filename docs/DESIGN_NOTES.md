# Phase 1 — Original design analysis (from the supplied `flowmoney.html`)

The supplied file is the authority. Its stylesheet was extracted **verbatim** into `client/src/styles/original.css`
and the React components reuse its exact class names, so the homepage is reproduced from the same CSS rather than re-measured by eye.
`app.css` only *adds* styles (forms, banners, tables, focus rings, responsive fixes).

## Tokens (from `:root`)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#070c18` | page, with two radial glows: `#1c2b57` top-right, `#251e51` bottom-left |
| `--panel` / `--panel2` | `#0d1629` / `#101d35` | surfaces |
| `--line` | `#20345b` | borders |
| `--text` / `--muted` | `#eef2ff` / `#8e9dbc` | text |
| `--blue` `--teal` `--violet` `--orange` | `#7695ff` `#4ce0c0` `#b68aff` `#ffad65` | loan · saving · misc · petrol |
| `--radius` | `20px` | cards use 17–22px |
Font stack: `Inter, ui-sans-serif, system-ui, …` (no remote fonts). Base size 14px / 1.5.

## Layout
- `.app` CSS grid: **190px | 1fr | 250px**, max-width 1600px.
- Left: brand (gradient ◈ logo), 4 nav buttons (Home, Transactions, Reports, Settings), privacy note.
- Main: header (eyebrow month, h1 25px, subtitle, month `<select>`) → hero card (3 metrics split by 1px dividers, two progress bars) →
  "Spending overview" (4 cards, 4-col grid, 12px gap) → heatmap panel (68px label column + 12 month columns, 5-step ramp) →
  "Category breakdown" accordions (Loan open by default).
- Right: profile card, monthly goal, quick actions, quote card, footnote.
- Category cards: tinted gradient per category (`#101e42`, `#0c282d`, `#2a201b`, `#211b3a`), 38px icon "orb", hover lifts 3px.
- Heat ramp: `#152747 → #243d73 → #354e9a → #595ec3 → #8b72ed`, cell opacity `0.48 + 0.52·intensity`.

## Deliberate differences from the original (and why)
| Original | Now | Reason |
|---|---|---|
| Data in browser `localStorage`; "stays in your browser" | Local SQLite file via a local API; text says "stays on this device" | Required by the brief; also the accurate statement |
| xlsx loaded from jsDelivr CDN | Will be bundled locally (Excel import is a later stage) | CDN request breaks the offline/no-third-party rule |
| Heatmap = trailing 12 months | Calendar year (Jan–Dec) with a year switcher | Brief requirement |
| Missing months drawn as 0 | Drawn as a dashed empty cell ("no data") | No fabricated history |
| Mobile hid inactive nav links | All four stay visible | Usability |
| Right column hidden under 1120px | Moves below main content | Brief requirement |
| Glyph icons (⌂ ♧ ⛽ ✣) | Kept | Fidelity to the original look (Lucide not used yet) |
| Greeting "Your money, in focus." | "Good afternoon, <name>" | Brief requires a personalised greeting |

## Changes requested after Stage 1
| Change | Detail |
|---|---|
| Quick actions panel removed | Right rail is now: profile, monthly goal, footnote |
| "Small steps, big dreams" card removed | — |
| Petrol → Necessary expenses | Orange accent and ordering kept (3rd card); icon is ✚ |
| Fourth summary metric: Remaining | Hero grid is 4 columns (2×2 below 900px) |
| Running "left after" figure per entry | Muted text beside each amount |
| Month-end sums | Necessary & Misc show a final figure in heatmap cells once the month has ended |

## Phone layout (installable app)
Applies only when `html[data-phone]` is set (width ≤ 650px, or a touch device in landscape with height ≤ 500px). Desktop/tablet are untouched.
| Area | Phone behaviour |
|---|---|
| Navigation | Slim top bar (logo + "On this device"), bottom tab bar, floating ＋ button on Home/Transactions |
| Header | Stacked; month picker gains ‹ › arrows |
| Summary | 2×2 metrics; category cards 2×2 |
| Heatmap | Scrolls sideways; row labels stay fixed |
| Panels | Compact rows, 34px-tall buttons, running balance under each entry |
| Forms | Bottom sheets, 16px inputs (no iOS zoom), pinned Save/Cancel |
| Transactions | Table becomes cards |
| Reports | KPI 2×2, month table scrolls with a fixed first column |
