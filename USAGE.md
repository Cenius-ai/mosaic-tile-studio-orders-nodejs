# Using Mosaic Tile Studio Orders

Sign in at `/login` with `cenius@cenius.ai` / `cenius` (the card prints the same line). You land on the
dashboard of the seeded studio, Ashgrove Mosaic Studio.

## 1. Read the dashboard

- The four tiles across the top count commissions by status and total the sheets in the glass room.
- **Recent commissions** lists the four newest with client, status chip, sheet requirement and a humanised due
  label (`Due in 9 days`, `Overdue by 14 days`).
- **Stages in progress** names the active workshop stage of every commission that is not yet completed.
- **Low glass** lists every lot at or below its threshold with its sheet count.

## 2. Quote a commission

`Commissions → New commission` (`/commissions/new`). Title is required; dimensions are optional but must be
positive numbers. Saving creates the commission **and** its five workshop stages, and lands you on the detail
page. The new commission appears at the top of `/commissions`.

Editing lives on `/commissions/:id/edit`; the destructive block at the bottom deletes the commission together
with its palette and stage history (it asks first).

## 3. Build the palette

On the commission detail page, `Add a tesserae colour` takes a colour name, a swatch, a material (smalti or
vitreous glass), an optional size in millimetres and the tesserae count. The sheet count is not typed in — it is
computed: `ceil(tesserae ÷ 225)` for smalti, `ceil(tesserae ÷ 400)` for vitreous. A 450-tesserae smalti line
reads `450 tesserae · 2 sheets`. The table footer totals both columns, the dominant colour is listed first, and
each line can be removed.

## 4. Work the glass room

`Glass room` (`/stock`) groups lots into Smalti and Vitreous glass. Add a lot with a colour name, swatch, sheets
on hand and a low-stock threshold; the same material + colour is rejected with a clear message. Each row has an
inline adjust form that takes a signed delta (`3` adds, `-3` removes, and it refuses to go below zero) and a
delete button. Rows at or below their threshold carry a `Low · N left` chip.

## 5. Reserve sheets from the palette

On a commission whose palette is not yet covered, press **Reserve sheets from stock**. The app works out the
sheets every uncovered line needs, checks every matching lot, and then either:

- deducts all of them in one transaction, marks each line `Reserved N` and disables the button as
  **All sheets reserved**; or
- changes nothing and tells you which colour is short, e.g.
  `Not enough Gold Leaf 001: needs 10 sheets, 2 on hand — 8 sheets short. Nothing was reserved.`

Reservations are deliberately one-way in this MVP: removing a palette line leaves its sheets out of the glass
room, and you put them back with an adjust on the lot.

## 6. Walk the stages

The detail page renders the five fixed stages as a timeline: Design & cartoon, Tesserae cutting, Gluing,
Grouting, Fixing. The active stage is marked and carries the accent glow.

- **Complete stage** marks the current stage done with a completion timestamp, activates the next one, and turns
  a quoted commission into *in progress*.
- Completing **Fixing** marks the commission *completed*, which moves it out of *Stages in progress* and into the
  completed count on the dashboard.
- **Reopen** returns the most recently completed stage to active, clears its completion time and puts the
  commission back to *in progress*.
- Every stage has a one-line workshop note that saves in place.

## 7. Two studios, no crossover

Sign out and sign in as `demo@mosaic.studio` / `mosaic123` (Kiln Lane Mosaic). You see only that studio's two
commissions and three glass lots. Opening an Ashgrove commission by URL returns the styled 404 page — a row that
belongs to another studio behaves exactly like a missing row.

## 8. Never lose your place

Flash banners confirm every write (`“Harbour Light Mosaic” created — its five workshop stages are ready.`) and
disappear on the next navigation. `⌘K` / `Ctrl+K` opens the jump-to palette from anywhere in the studio.
