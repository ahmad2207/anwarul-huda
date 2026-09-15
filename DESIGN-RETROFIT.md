# Design retrofit

For a system already built through Phase 7 with default styling. This replaces Phase 0.5, which assumed an empty project.

Read `docs/DESIGN.md` first. This file is about how to apply it to code that already exists.

---

## The principle

Do not restyle the application in one pass. A single sweeping visual refactor across seven phases of working code will break something in payments or permissions, and you will not know which change did it.

Work in the order below. Each step is committable on its own and each one is reversible.

**Do all of this on a branch.**

```bash
git checkout -b design-retrofit
```

If it goes wrong you throw away the branch, not the project.

---

## How much work this actually is

It depends entirely on one thing, which step R1 finds out: whether the existing code uses Tailwind theme tokens and shadcn components, or whether colours are hardcoded per file.

If it used the theme, R2 alone will transform the look of every screen in the application in a single commit, because the tokens cascade. That is the likely case if `CLAUDE.md` was followed.

If colours are hardcoded as `bg-blue-600` and `text-gray-500` scattered across two hundred files, the same result takes several passes. Still tractable, just slower.

Either way, the expensive part is not colour. It is the three surfaces in section 4 of `DESIGN.md`, because those are structural. If every screen currently shares one admin layout, the member area and the check-in screen need real rework, not a repaint.

---

## R1: Audit, change nothing

```
Read docs/DESIGN.md in full. Then audit the existing application. Change no code in this step.

Produce a report covering:

1. Every route in the application, grouped by module, with which layout it currently uses.
2. Colour: list every distinct colour value in use. For each, say whether it comes from the Tailwind theme, a shadcn token, or is hardcoded in a component. Count the hardcoded ones.
3. Typography: what font is currently loaded, how, and what base sizes are in use per route group.
4. Components: where are shadcn components used as shipped, where have they been customised, and where has something been hand rolled that a shared primitive should cover. Specifically flag every place a table of data is rendered as cards.
5. Semantic colour: every place green, red, amber or yellow currently appears, and what it means there. I need to know where colour currently carries meaning and where it is decoration.
6. Layout: do the admin, member and check-in routes share one layout? List which routes would need structural change to match section 4 of DESIGN.md.
7. Copy: flag any button labelled "Submit", any error message that says only that an error occurred, and any empty state with no call to action.

End with an honest estimate of which of the steps R2 to R6 will be cheap and which will be expensive, given what you found.

Write this to docs/design-audit.md. Do not change any application code.
```

Read that report before going further. It tells you whether the rest of this is a day or a fortnight, and it may change the order.

---

## R2: Tokens only

The highest return step. Do not let it touch components.

```
Apply the design tokens from docs/DESIGN.md. This step changes theme configuration and font loading only.

1. Load IBM Plex Sans, IBM Plex Sans Arabic and IBM Plex Mono, self hosted with next/font. Remove whatever font is currently loaded.
2. Replace the Tailwind theme colours with the tokens in DESIGN.md: navy-900 (#003265), navy-700, amber-500 (#FF9700), amber-800, paper, sabon, alert, ink, ink-2. Map the shadcn CSS variables onto these so shipped components inherit them.
3. Set border radius to 4px globally. Remove drop shadows from the theme and replace surface separation with a 1px border in a light navy tint.
4. Add the organisation logo at public/logo.svg with a white variant for use on navy.
5. Where the audit found hardcoded colours, replace them with the matching token. Do not change any other property on those elements. Do not restructure any component.

Rule: amber-500 is never used for text or icons on a light background. It measures 2.17 against white and fails outright. It appears on navy, or as a small solid mark. Use amber-800 for attention on white.

Do not change layout, component structure, copy or logic in this step.

When done, show me a list of every file touched and screenshots of five representative screens: the member list, the payment desk, the charity dashboard, the check-in screen and the member area.
```

Commit here. This alone will change how the whole application feels.

---

## R3: Make colour mean something

```
Read section 2 of docs/DESIGN.md and the semantic colour findings in docs/design-audit.md.

Right now colour is being used inconsistently. Fix that and nothing else.

1. sabon is used only for confirmed states: paid, approved, checked in, synced.
2. amber-800 is used only for attention: pending approval, arrears, till variance, unsynced check-ins, unmatched device logs.
3. alert is used only for voided, rejected, failed and shortfall.
4. Anywhere colour currently appears as decoration rather than state, remove it.
5. Colour is never the only signal. Every coloured status also carries a word and an icon.
6. Wings must not be colour coded anywhere. If any screen colours the men's, women's or youth wing differently, remove it and use the letter from the member number in mono instead.

Build a single StatusTag primitive that owns all of this, and replace every ad hoc status rendering with it. That is the only structural change permitted in this step.

Show me every place a status is rendered, before and after.
```

---

## R4: Separate the three surfaces

The expensive one, and the one that matters most. Do it one surface at a time, committing between.

```
Read section 4 of docs/DESIGN.md.

The application currently shares one layout across surfaces that have different jobs. Separate them. Do this one surface per session, starting with check-in.

Check-in first, because it is the furthest from where it should be:
- Full bleed navy-900, not the admin shell
- 20px minimum base size
- One oversized search field, focused on load
- Result rows minimum 64px
- The running count as the largest element on screen, in amber-500
- The offline queue indicator permanently visible, never a toast

Do not touch the check-in logic, the offline queue or the sync behaviour. This is presentation only. If you find yourself needing to change how the queue works in order to change how it looks, stop and tell me.

Show me the diff before committing.
```

Then repeat with the member area:

```
Now the member area. Read section 4.2 of docs/DESIGN.md.

- Single column, no sidebar, 17px base
- Touch targets 44px minimum
- Plain language, no system vocabulary
- Light payload. Remove any chart library, heavy component or admin-only dependency that is currently being shipped to member routes. Tell me what you removed and what it weighed.

Presentation only. Do not change what data a member can see or any permission check.
```

Then the admin desk:

```
Now the admin desk. Read section 4.1 of docs/DESIGN.md.

- Fixed navy rail carrying the logo
- 14px base, 40px rows
- Anywhere tabular data is currently rendered as cards, convert it to a real table with sticky headers and tabular numerals
- Amounts and member numbers in mono, amounts right aligned
- Search focused on page load in every list view

Presentation only. Do not change any query, any permission check or any wing scoping.
```

---

## R5: Shared primitives

```
The application has grown its own variations of the same things. Consolidate.

Build these primitives to the DESIGN.md spec and replace every duplicate implementation:
DataTable, StatusTag (already built in R3), Money, MemberNumber, PageHeader, EmptyState, FormField.

Money and MemberNumber render in mono. Money right aligns and formats kobo to Naira. FormField always renders a real label, never a placeholder standing in for one.

Then add a /styleguide route showing every token, type scale and primitive on one page, behind the super admin role.

Replace one module per commit, not all at once. Start with members, and show me that diff before continuing to the others.
```

---

## R6: Copy and accessibility

```
Read sections 6 and 8 of docs/DESIGN.md and the copy findings in docs/design-audit.md.

1. Every button says what happens. "Record payment", not "Submit". An action keeps its name through the whole flow.
2. Every error says what happened and what to do. Replace anything that says only that an error occurred.
3. Every empty state invites an action.
4. Organisation spellings throughout: Jumu'ah, ta'leem, halaqah, sadaqah, zakat, janazah, da'wah, nikah.
5. No em dashes anywhere.

Then the accessibility pass:
- Visible focus ring in navy-700 on every interactive element. Find and remove every outline-none.
- Every input has a real label.
- Touch targets 44px in the member area, 64px at check-in.
- Test at 200 percent zoom and fix what breaks.
- Confirm no status is communicated by colour alone.

Produce a table of what you changed and anything you could not fix without a structural change.
```

---

## R7: Print

Left until last because it is separable and often forgotten entirely.

```
Read section 7 of docs/DESIGN.md.

Add print stylesheets for the four printed artefacts: the payment receipt, the member card, the arrears list and the charity committee report.

Black on white, no background fills, mono for figures, logo and the Arabic line in the header. Receipt sized for both A4 and thermal width. The member card carries the logo, the member number in mono, the QR code and the Guiding Lights line.

Show me a print preview of each.
```

---

## Sequencing against Phase 8

Run this retrofit before Phase 8, not after. The biometric bridge is a separate service and will not conflict with any of it, but the enrolment and device management screens it adds will be built to the new standard instead of adding more to retrofit later.

## What not to do

- Do not run two of these steps in one session.
- Do not accept a change to finance, permissions or the offline queue in a step described as presentation only. If Claude Code says it needs to, that is a signal something is tangled, and it is worth understanding before agreeing.
- Do not skip R1. Guessing at the current state is how a retrofit turns into a rewrite.
