# Design audit (R1)

Produced against the codebase as of the Phase 7 commit (`cd0e924`). No application code was changed to produce this report. Read alongside `DESIGN.md` (repo root; this report keeps the path R1's own instructions gave, `docs/design-audit.md`, even though `DESIGN.md` and `DESIGN-RETROFIT.md` themselves currently live at the repo root rather than under `docs/`).

---

## 1. Routes, grouped by module, with current layout

| Layout | Routes |
|---|---|
| **Root only** (`app/layout.tsx`, no section chrome) | `/`, `/login`, `/register` |
| **Admin** (`app/admin/layout.tsx`, fixed sidebar shell) | `/admin` (dashboard); Membership: `/admin/members`, `/admin/members/[id]`, `/admin/members/[id]/card`, `/admin/members/cards`, `/admin/members/import`, `/admin/approvals`; Finance: `/admin/payments`, `/admin/payments/new`, `/admin/payments/[id]`, `/admin/contributions/plans`, `/admin/contributions/generate`, `/admin/cash-sessions`, `/admin/reports`, `/admin/reports/arrears`, `/admin/reports/collections`; Charity: `/admin/charity`, `/admin/charity/funds`, `/admin/charity/cases`, `/admin/charity/cases/new`, `/admin/charity/cases/[id]`, `/admin/charity/disbursements/new`, `/admin/charity/print`; Attendance: `/admin/attendance`, **`/admin/attendance/[id]` (check-in)**, `/admin/attendance/reports`, `/admin/attendance/reports/gatherings`, `/admin/attendance/reports/inactive`, `/admin/attendance/reports/member`, `/admin/attendance/reports/wings`; Content: `/admin/content`; System: `/admin/audit` |
| **Account** (`app/account/layout.tsx`, plain single column) | `/account`, `/account/contributions` |
| **Library** (`app/library/layout.tsx`, plain single column, near duplicate of the account layout) | `/library`, `/library/[slug]` |

**The check-in screen (`/admin/attendance/[id]`) currently lives inside the admin sidebar shell.** It is not its own surface. This is the single largest gap against section 4 of `DESIGN.md`: the "full bleed navy-900" surface described there does not exist yet; check-in today looks like every other admin page, just with a bigger number on it.

`app/account/layout.tsx` and `app/library/layout.tsx` are near-identical (same centred column, same header, same sign-out button), built as two separate files rather than one shared "member shell" component. Worth folding into one when the member area is touched.

---

## 2. Colour

The Tailwind theme (`app/globals.css`) is the **unmodified shadcn default**: grayscale oklch values, no brand colour defined anywhere in the theme. `--radius: 0.625rem` (10px), not the 4px `DESIGN.md` specifies. Card surfaces are separated with `ring-1 ring-foreground/10`, close in spirit to "a 1px border in a light navy tint" but not navy, and a few shadow rules exist inside `components/ui/sidebar.tsx` and `dropdown-menu.tsx` (used for the floating sidebar variant and menu popovers, both edge cases rather than the general surface treatment).

Because the app consistently used theme tokens (`bg-card`, `text-muted-foreground`, `border-input`, `text-destructive`, and so on) rather than one-off literal colours for its structural styling, **almost nothing needs to change file by file**. Retheming `app/globals.css` cascades correctly, exactly as `DESIGN-RETROFIT.md` predicts for a codebase that followed `CLAUDE.md`.

The exception is status colour, applied ad hoc with literal Tailwind scale classes rather than a token:

| File | Line | Class |
|---|---|---|
| `app/admin/approvals/page.tsx` | 76-77 | `border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950`, `text-amber-900 dark:text-amber-200` (possible duplicate warning) |
| `app/admin/charity/cases/[id]/page.tsx` | 124 | `text-amber-700 dark:text-amber-400` (self approval blocked warning) |
| `app/admin/attendance/[id]/check-in-client.tsx` | 259, 311 | `text-amber-700 dark:text-amber-400` (pending sync count and tag) |
| `app/admin/content/content-form.tsx` | 36 | `border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400` (upload success) |
| `app/admin/members/import/import-wizard.tsx` | 330, 358 | `text-amber-700 dark:text-amber-400` (warning row count) |

**8 hardcoded colour declarations across 5 files.** All amber or emerald, all already meaning roughly what `DESIGN.md` wants (`amber-800`-equivalent for attention, `sabon`-equivalent for confirmed), so R3 is a rename against a shared `StatusTag`, not a redesign.

Two literal hex values exist, in `app/global-error.tsx` (`#666`, `#ccc`). These are deliberate: this file renders when the root layout itself has failed, so it cannot depend on Tailwind or the theme being intact, and uses inline styles on purpose. Leave as is.

No colour-only status indicator (a bare dot with no label) was found anywhere.

---

## 3. Typography

`app/layout.tsx` loads **Geist Sans and Geist Mono** via `next/font/google`, applied globally through `font-sans` on `<html>`. The *mechanism* is already correct for `DESIGN.md`'s "self hosted with next/font" instruction (`next/font/google` downloads and self-hosts at build time); only the font family needs to change, to IBM Plex Sans, IBM Plex Sans Arabic and IBM Plex Mono. No Arabic font is loaded, because no Arabic text is rendered anywhere in the app today.

`font-mono` appears **zero times** in any page or component; it exists only as an unused CSS variable declaration. No amount, member number or receipt number is currently set in monospace anywhere.

There is no per-surface base size. Text size is applied per element, uniformly across every route group:

| Route group | `text-xs` | `text-sm` | `text-base` | `text-lg`+ |
|---|---|---|---|---|
| `app/admin/**` | 161 | 174 | 34 | 32 |
| `app/account/**` | 1 | 6 | 2 | 2 |
| `app/library/**` | 11 | 13 | 0 | 2 |
| `app/admin/attendance/[id]` (check-in) | 6 | 6 | 1 | 2 (one `text-2xl`, the running count) |

`text-sm`/`text-xs` (14px/12px) dominate everywhere, including the member area and the check-in screen. The check-in count, the one place `DESIGN.md` wants the single largest element on screen, is `text-2xl` (24px) inside a screen whose surrounding text is mostly 12-14px, on a page that otherwise looks identical to an admin list. Nothing in the app currently reaches the 20px floor `DESIGN.md` sets for check-in as a *base*, only as an occasional large number.

---

## 4. Components

**shadcn primitives present**, all used largely as shipped, styling driven by the same theme tokens covered in section 2: `avatar`, `button`, `card`, `dropdown-menu`, `input`, `label`, `separator`, `sheet`, `sidebar`, `skeleton`, `tooltip`. `button.tsx` has custom size variants (`xs`, `icon-xs`, `icon-sm`) added on top of the shadcn base, otherwise these are unmodified.

**No shared primitive exists for `Select`, `Textarea`, or `Checkbox`.** Every one is hand rolled per file with a copy-pasted className:

- 21 files hand roll a `<select>` with the identical string `h-8 rounded-md border border-input bg-background px-2 text-sm`.
- 3 files hand roll a `<textarea>` with the identical string `rounded-md border border-input bg-background px-2 py-1 text-sm`.
- 6 files hand roll a checkbox (`<input type="checkbox">`) with no shared wrapper.

**No shared status rendering exists either.** 17 files each define their own local label map or function for the same job (`statusLabel`, `STATUS_LABELS`, `TYPE_LABELS`, `METHOD_LABELS`), all rendering as plain text with no colour, tick or icon at all in the overwhelming majority of cases. This is the gap `R3`'s `StatusTag` and `R5`'s primitive list are meant to close, and it is larger than a rename: there is currently nothing to rename, mostly bare text.

**Money**: already centralised at the function level (`lib/money.ts`'s `formatNaira`), which is good, but never rendered in mono (see section 3) and not wrapped in a shared display component, so alignment and mono styling would need adding at every call site until a `Money` primitive exists.

**Tables rendered as cards** (the specific thing R1 asks to flag):

- `app/admin/approvals/page.tsx`: every pending member (a genuine row of tabular data: name, phone, gender, registration date, wing) renders as its own full `<Card>` with header and border.
- `app/admin/charity/page.tsx`: every fund renders as its own full `<Card>` containing a nested table. Softer case than the approvals queue, since each fund's block carries a real two-period comparison and a zakat breakdown, closer to a report section than a single record, but it is still one row of "fund data" per card.

**Tabular data rendered as plain row-`div`s, not a real `<table>`, and not cards either** (a middle category `DESIGN.md` section 4.1 would still want converted, since it explicitly asks for "a real table with sticky headers"): cash sessions, contribution plans, funds (the management list at `/admin/charity/funds`, distinct from the dashboard's card treatment above), recent imports, gatherings.

**15 pages already use a real `<table>`**: members, payments, charity cases, content admin, audit log, arrears, collections, and all four attendance reports. None of them have a sticky header, none use tabular numerals (`tabular-nums`) or mono on numeric columns, and row padding is `p-2` rather than a fixed 40px row height. This is a consistent, blanket pattern across all fifteen, built the same way each time, not fifteen separate problems.

`autoFocus` on a list's own search field exists in exactly one place, the check-in search box. Every other search input (members, payments, content, library, every report) does not focus on load, which `DESIGN.md` section 4.1 asks for across the admin desk.

---

## 5. Semantic colour: where colour currently carries meaning, and where it does not

| Colour as used today | Where | What it means | Matches a `DESIGN.md` token |
|---|---|---|---|
| `amber-700`/`amber-400`/`amber-900` | Possible duplicate warning, self-approval-blocked warning, pending sync count and tag, import warning rows | Attention: something needs a look before proceeding | `amber-800` (attention on white) |
| `emerald-500`/`emerald-700` | Content upload success message | Confirmed: the action completed | `sabon` (confirmed) |
| `destructive` (shadcn token, not hardcoded) | Void payment button, reject case button, delete household member, form error text | Destructive action or a hard validation failure | `alert` (voided, rejected, failed) |
| Plain text, no colour | Every member status, gathering type, contribution status, payment method, case status, cash session status | The actual state of the record | Currently nothing; this is most of the app |

The honest finding: colour is not currently used as decoration anywhere (nothing to strip out for that reason), but it is also barely used as a signal. The five hardcoded instances above are the entire footprint of colour actually meaning something today. Everywhere else, status is plain text, which technically satisfies "colour is never the only signal" only because there is usually no colour to begin with. `R3` is mostly additive work (build `StatusTag`, wire it in nearly everywhere), not a cleanup of misused colour.

No wing is colour coded anywhere. The three wings are already distinguished only by name and the M/W/Y letter in the member number, exactly as `DESIGN.md` requires. Nothing to fix here.

---

## 6. Layout: do admin, member and check-in share one layout?

Two layouts exist today, not three: `admin` and `account`/`library` (which are themselves two copies of the same design). Check-in has no layout of its own; it is an admin page.

Routes that would need structural change to match section 4 of `DESIGN.md`:

- **`/admin/attendance/[id]`** (check-in): needs to leave the admin shell entirely for a full bleed `navy-900` surface with no sidebar, a 20px+ base, and the running count as the dominant element. This is the expensive, important one `DESIGN-RETROFIT.md` itself flags and asks to do first.
- **`app/account/layout.tsx` and `app/library/layout.tsx`**: not structurally wrong (already single column, no sidebar), but duplicated, and neither currently sets a 17px base or 44px touch targets; both default to the same ad hoc per-element sizing as the admin desk (section 3).
- **`app/admin/layout.tsx`**: structurally already the right shape (fixed rail, content area) for section 4.1; needs the rail in `navy-900` with the logo, 14px base, and 40px table rows, not a rebuild.

---

## 7. Copy

**Buttons named "Submit"**: one instance, `app/register/register-form.tsx`, "Submit registration" (and "Submitting..." while pending). Not the bare "Submit" `DESIGN.md` warns against by name, but still built on that verb rather than one that names the action the way "Record payment" does. Every other button in the app already names its action (Record payment, Void payment, Approve, Reject, Check in, Upload, and so on).

**Errors that say only that an error occurred**: widespread. Roughly twenty call sites return the literal fallback `"Invalid input."` when a Zod parse fails with no message (a genuine fallback, not the primary path, but still what a user sees when it fires), plus explicit instances of `"Something went wrong"` / `"Something went wrong. Please try again."` / `"Not allowed."` in `app/register/actions.ts`, `app/admin/attendance/close-gathering-button.tsx`, `app/admin/attendance/[id]/check-in-client.tsx` (twice), `app/admin/members/[id]/actions.ts` (three times), `app/admin/charity/cases/[id]/case-transition-forms.tsx` (twice), and both new error boundaries (`app/error.tsx`, `app/global-error.tsx`, deliberately generic there since a boundary catches genuinely unexpected failures it cannot describe specifically).

**Empty states with no call to action**: all seventeen found. Every single one is static text ("No sessions yet.", "Nothing waiting for approval.", "No gatherings yet.", "No funds yet." three times over, and so on), none of them link or point to the action that would fill the list. `DESIGN.md`'s own example, "Open a cash session to start", exists nowhere yet; the closest today is `app/admin/cash-sessions/page.tsx`'s "No sessions yet." with no link to opening one.

---

## 8. What R2 through R6 will cost

**R2, tokens: cheap.** The theme is untouched shadcn, tokens cascade correctly, and only 8 hardcoded colour declarations across 5 files need a pass. The two real costs are outside the codebase: the actual **logo file does not exist anywhere in this repository** (`public/` holds only the unused default Next.js starter SVGs), so `DESIGN.md`'s colour sampling was done against a file that was never checked in, and a real `logo.svg` (plus a white-on-navy variant) needs to be supplied before this step can finish; and no Arabic font or Arabic copy exists yet, so that part of R2/R7 is new work, not a swap.

**R3, semantic colour: cheap once R2 lands.** There is very little misuse to correct (5 files); the actual work is building `StatusTag` and wiring it into the ~17 places that currently render status as bare text, which is more "build it" than "fix it."

**R4, the three surfaces: expensive, as `DESIGN-RETROFIT.md` itself expects, and check-in is the most expensive part of it.** It is not a repaint: check-in needs to move out of the admin shell into its own full bleed layout without touching the offline queue or sync logic sitting right next to the markup that needs to change. The admin desk needs five list views (cash sessions, plans, funds, recent imports, gatherings) converted from row-divs to real tables, plus sticky headers, tabular numerals and page-load search focus added across all twenty of its list views. The member area is comparatively cheap: no chart library or heavy dependency was found on `/account` or `/library` to strip out, so that step is mostly sizing and touch targets, not removal.

**R5, shared primitives: moderate, and genuinely additive.** `Select`, `Textarea`, `Checkbox`, `StatusTag`, `Money`, `MemberNumber`, `DataTable`, `PageHeader`, `EmptyState` and `FormField` do not exist in any form today (Money's formatting logic exists, its display component does not), so this is new component work applied against ~30+ call sites (21 selects, 3 textareas, 6 checkboxes, 17 status renderers), not a consolidation of competing implementations.

**R6, copy and accessibility: moderate.** The copy half is mechanical but touches nearly every action file (twenty-plus generic error fallbacks, seventeen empty states). The accessibility half needs its own look before estimating: this audit did not check for `outline-none` usage, focus ring survival, or 200 percent zoom behaviour, since that requires interaction rather than static reading, and R6 asks for that pass directly.

**R7, print: cheap in code, blocked on the same missing asset as R2.** Print handling already exists for two of the four artefacts (the charity dashboard and member cards) with sensible groundwork (`print:hidden`, a `PrintButton`, `[data-slot="sidebar"]` hidden globally under `@media print`). All four need the Arabic line and the logo in their header, so this step is blocked on the same logo file and Arabic copy R2 needs.
