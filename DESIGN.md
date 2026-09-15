# Design direction

Authoritative for every visual decision in the project. Read it before building any screen. It wins over component library defaults and over habit.

The palette is taken from the organisation's existing logo, sampled directly from the file. Nothing here is invented.

---

## 1. What the identity already says

The logo is a navy roundel. Inside it, an amber crescent holding a lit lantern, with small amber stars scattered around it. The Arabic reads رابطة أنوار الهدى نيجيريا. The English tagline is **Guiding Lights**.

That is the whole brief and it is a good one. A light in the dark. The organisation has already decided what it is about, so the system should not go looking for a different metaphor.

Two consequences follow directly:

**Navy is the ground, amber is the light.** Amber never appears as a large field or a background. It appears as a small bright thing against navy, because that is what it means. Used as a page background or a button fill on white, it stops being a light and becomes decoration.

**The dark surfaces are the point, not a dark mode.** The check-in screen is a deep navy field with one amber number glowing in it. That is the logo, working.

Note on the name: the logo reads **Anwaru-l-Huda League of Nigeria**. Earlier documents in this project use "Anwar-ul-Huda". Settle which spelling is official and use it consistently everywhere, including in the member number prefix.

---

## 2. Colour

Sampled from the logo, plus the minimum needed for a finance system to communicate state.

| Token | Hex | Source | Use |
|---|---|---|---|
| `navy-900` | `#003265` | logo | Primary. Sidebar, check-in field, primary buttons, headings |
| `navy-700` | `#0A4585` | derived | Links and active states on white, hover on navy |
| `amber-500` | `#FF9700` | logo | The light. Only on navy, or as a small solid mark |
| `amber-800` | `#8F5300` | derived | Attention on white: pending, arrears, till variance, unsynced |
| `paper` | `#F4F6FA` | derived | Application background |
| `sabon` | `#2F6B4F` | added | Confirmed only: paid, approved, checked in, synced |
| `alert` | `#B02418` | added | Voided, rejected, failed, shortfall |
| `ink` | `#1B2440` | derived | Body text |
| `ink-2` | `#5A6079` | derived | Secondary text |

Measured contrast, all against their intended background:

| Pair | Ratio | Grade |
|---|---|---|
| navy-900 on white | 12.77 | AAA |
| white on navy-900 | 12.77 | AAA |
| amber-500 on navy-900 | 5.89 | AA |
| amber-800 on white | 6.17 | AA |
| sabon on white | 6.29 | AA |
| alert on white | 6.75 | AA |
| ink on white | 15.30 | AAA |

**`amber-500` is never used for text on white.** It measures 2.17 against white, which fails outright. This is why there are two ambers. The bright one lives on navy where it belongs, the dark one does the work on light surfaces. Do not reach for the bright one because it looks more like the logo.

Three rules that are not negotiable.

**Colour carries state, never decoration.** Amber means something needs attention. Sabon means confirmed. Alert means voided or failed. If a coloured element does not mean one of those things, it is the wrong colour. This is a finance system, and once colour is also styling, the signal stops working.

**Colour is never the only signal.** Paid shows a tick and the word "Paid". A pending row shows a label, not just a coloured dot.

**Wings are never colour-coded.** No pink for the women's wing, no blue for the men's. One identity across all three, distinguished by the M, W or Y already sitting in the member number, set in mono. Expect someone on the committee to suggest colour-coding. The answer is no, because it puts gender ahead of membership and it burns the colour vocabulary the finance screens need.

---

## 3. Type

One family carries the interface, differentiated by weight and size rather than by a second voice.

- **IBM Plex Sans** for the whole interface. Humanist, slightly mechanical, holds up small in dense tables, and does not read as the default corporate sans.
- **IBM Plex Sans Arabic** for Arabic. A true companion face, so the Arabic in the logo lockup and on printed receipts sits properly beside the Latin rather than clashing.
- **IBM Plex Mono** for figures only: amounts, member numbers, receipt numbers, references. This is functional. Money must align on the decimal and member numbers must be comparable at a glance. Not for labels, headings or texture.

Three bases, because the three surfaces have different jobs:

| Surface | Base | Why |
|---|---|---|
| Admin desk | 14px | Dense tables, laptop, an officer working at speed |
| Member area | 17px | Mid-range Android, wide age range, held at arm's length |
| Check-in | 20px minimum | Standing, one hand, glanced at rather than read |

Scale ratio 1.25. Line length capped at 70 characters. Sentence case throughout. No tracked-out capitals as labels.

Arabic appears in four places only: the login screen lockup, the printed receipt header, the printed member card, and the printed committee report. It is not interface chrome.

---

## 4. The three surfaces

Three different products sharing one palette, not one design at three breakpoints.

### 4.1 Admin desk

Laptop, seated, repetitive. The finance officer records fifty payments in a sitting.

```
+----------+--------------------------------------------------+
|          |  Members                          [+ Add member] |
|  LOGO    |  [search.......................]  [wing v]       |
|          |  +---------------------------------------------+ |
|  Members |  | AHL/M/2026/0113  Musa Bala    Men's   Active | |
|  Approve |  | AHL/W/2026/0087  Zainab Sani  Women's Active | |
|  Payments|  | AHL/Y/2026/0044  Idris Kabir  Youth   Pending| |
|  Charity |  +---------------------------------------------+ |
|  Attend  |  Showing 1 to 50 of 2,417            < 1 2 3 >   |
+----------+--------------------------------------------------+
```

Rows, not cards. Content is not chopped into identical rounded boxes with identical shadows. A table is the right component for tabular data and it is also the fastest thing to scan.

Fixed left rail in `navy-900` with the logo at the top. Rows 40px. Member numbers and amounts in mono, amounts right aligned. Search focused on page load, because the officer is typing before the page finishes rendering. Every list action reachable by keyboard with the shortcut visible in the interface.

### 4.2 Member area

Mid-range Android, slow connection, possibly an elderly member. A member has about four things to do, so this is not a dashboard.

Single column, 17px base, generous spacing, large tap targets, no sidebar. Plain language with no system vocabulary. Contribution history, outstanding balance, the library, own details. That is all.

Keep the payload light. No chart libraries on member routes.

### 4.3 Check-in

This is where the identity does its work, and where all the boldness goes. Everything else stays disciplined so this can be loud.

```
+--------------------------------------------------+
|  Jumu'ah, 18 September            3 waiting to sync|
|                                                    |
|   [ search name or number..................... ]   |
|                                                    |
|   +--------------------------------------------+   |
|   | (photo)  Musa Bala                         |   |
|   |          AHL/M/2026/0113        [ Check in]|   |
|   +--------------------------------------------+   |
|                                                    |
|                     147          <- amber on navy  |
|                  checked in                        |
+--------------------------------------------------+
```

Full bleed `navy-900`. One oversized search field, always focused. Result rows minimum 64px, hittable with a thumb while standing. The running count is the largest element on the screen and the one place `amber-500` appears at size, because it is what the officer glances at and what they will be asked for. A lit number on a dark ground is the logo.

The offline state is permanently visible, never a toast that vanishes. An officer needs to know at all times whether check-ins are landing. Queued entries show a count in amber. On sync it turns `sabon` briefly, then goes quiet. That transition is the only non-essential motion in the product.

---

## 5. Components

shadcn/ui as the foundation, then override the defaults. Untouched shadcn is recognisable on sight.

- Radius 4px throughout. Not 8px, not pill buttons. This is an administrative record system and slightly square corners suit it.
- Almost no shadows. Separate surfaces with a 1px border in a light navy tint, not a soft grey drop shadow under every card.
- Buttons: solid `navy-900` primary, bordered secondary, `alert` text destructive. No gradients anywhere.
- Tables: sticky headers, tabular numerals, zebra striping off, hairline row separators.
- The logo appears in the admin rail, the login screen, the check-in header and on print. Nowhere else.

Motion is limited to what answers a click and the offline sync indicator. No entrance animations, no hover lift on cards, no fade-and-slide sections. Respect `prefers-reduced-motion`.

---

## 6. Writing in the interface

Not technical, wide age range. Plain language, sentence case, active voice.

- Buttons say what happens. "Record payment", not "Submit".
- An action keeps its name throughout. "Void payment" produces "Payment voided".
- Errors say what happened and what to do. Not "An error occurred", but "That phone number already belongs to AHL/M/2026/0113. Check whether this is a duplicate."
- Empty states invite an action. "No payments recorded today. Open a cash session to start."
- Organisation spellings: Jumu'ah, ta'leem, halaqah, sadaqah, zakat, janazah, da'wah, nikah.
- No em dashes anywhere.

---

## 7. Print

Print is part of the product. Receipts, member cards, the arrears list and the charity committee report all get handed to people.

Proper print stylesheets: A4 or thermal receipt width, black on white, the logo and Arabic line in the header, mono for figures, no background fills that drain a cartridge. A printed receipt is what a member keeps, so it should look considered.

The member card is the one printed piece that carries the full identity: navy, the logo, the QR code, the member number in mono, "Guiding Lights" beneath.

---

## 8. Accessibility floor

Not optional and not a later phase.

- Visible focus ring on every interactive element in `navy-700`, never removed
- Every input has a real label. A placeholder is not a label
- Touch targets 44px minimum in the member area, 64px at check-in
- Colour never the only signal
- Full keyboard operation of the admin desk
- Tested at 200 percent zoom
