# Change Order Tracker

Next.js 16 + Tailwind v4 + shadcn/ui + Framer Motion + Supabase.

## How to work in this repo

- Keep questions **short and gentle** — one or two sentences, not paragraphs. The user prefers brief clarifying questions over long back-and-forth.
- Code lives in [web/](web/). Run `cd web && npm run dev` from there.
- Main component: [web/src/components/ChangeOrderTracker.jsx](web/src/components/ChangeOrderTracker.jsx) — the full tracker (dashboard, board, list, calendar, contract views + modals).
- Data layer: [web/src/lib/useCOs.js](web/src/lib/useCOs.js). Dual-mode: Supabase when a user is signed in, localStorage fallback otherwise.
- DB schema: [web/supabase/schema.sql](web/supabase/schema.sql). Paste into the Supabase SQL Editor to apply.
- UI primitives: shadcn/ui components in [web/src/components/ui/](web/src/components/ui/). Style = "new-york", base color = stone, brand = orange-600.

## Design direction (durable preferences)

- **White + orange** palette. Red only for true errors / overdue. Emerald only for success (executed / approved). Avoid other accent colors.
- **SVG icons only** (Lucide). No emojis as UI icons.
- **No pill ovals in data tables** — use icon + inline text. Pills are for cards only.
- Don't regenerate rainbow color keys for CO type / trade / status. Those are already collapsed to the orange + stone palette in the `C` token object and `STATUSES` / `CO_TYPES` / `TRADE_CATS` / `PRIORITY` tables.
- Dates in PDF exports use numeric `MM-DD-YYYY` format.

## Projects

Six real hotel projects are wired in (prefix → name): TPSJ, SYBJ, CWSJ, HIS, HIBR, HWG. CO numbers are project-scoped (`{prefix}-CO-{nnn}`). See `PROJECTS` and `nextCONumber()` in the tracker component.
