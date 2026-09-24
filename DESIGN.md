# Design direction

Authoritative for every visual decision in the project. Read it before building any screen. It wins over component library defaults and over habit.

The palette is taken from the organisation's existing logo, sampled directly from the file. Nothing core here is invented; the supporting tones (a deeper navy, a soft amber glow, tinted pill backgrounds) are new but derived from the same source, not a different palette.

**Revision note.** This replaces the flat, minimal direction from the first pass (4px radius, hairline borders, almost no shadow, one plain sans throughout). That direction was correct about the palette and wrong about the mood: administrative flatness read as bureaucratic rather than trustworthy, and rationed the amber so hard it barely felt like light at all. This version keeps the same navy and amber, the same three surfaces, the same non-negotiable rules about colour and accessibility, and changes the execution: real depth, a warmer ground, a serif for character, and amber used with actual confidence.

---

## 1. What the identity already says

The logo is a navy roundel. Inside it, an amber crescent holding a lit lantern, with small amber stars scattered around it. The Arabic reads رابطة أنوار الهدى نيجيريا. The English tagline is **Guiding Lights**.

That is the whole brief and it is a good one. A light in the dark. The organisation has already decided what it is about, so the system should not go looking for a different metaphor, and it should not be shy about it either.

Two consequences follow directly:

**Navy is the ground, amber is the light.** Amber never appears as a large field or a page background. It appears as a bright, deliberate thing against navy: a glow, a lit dot, a warm gradient edge, because that is what it means. Used as a flat background or a button fill on white, it stops being a light and becomes decoration.

**The dark surfaces are the point, not a dark mode.** The check-in screen is a deep navy field with one amber number glowing in it, a real radial light, not a flat number in an accent colour. That is the logo, working.

Note on the name: the logo reads **Anwaru-l-Huda League of Nigeria**, and that is the spelling used everywhere in the system now, running text included. An earlier revision of this document settled on "Anwar-ul-Huda" for running text instead, keeping the logo's own spelling only for describing the artwork itself; that decision has been reversed, since the point of a name is to match what the people it names actually call themselves. The member number prefix (`AHL`) is unaffected either way: it is an initialism, not a spelling of the name.

---

## 2. Colour

Sampled from the logo, plus a small set of derived tones for depth and for the states a finance system has to communicate.

| Token | Hex | Source | Use |
|---|---|---|---|
| `navy-950` | `#041B33` | derived | Deepest ground: check-in field, sidebar gradient base |
| `navy-900` | `#003265` | logo | Primary. Sidebar, primary buttons, headings on white |
| `navy-800` | `#0F3D6E` | derived | Mid step for gradients and hover states on navy |
| `navy-700` | `#0A4585` | derived | Links and active states on white |
| `amber-500` | `#FF9700` | logo | The light. Glows and small solid marks on navy |
| `amber-300` | `#FFC066` | derived | Soft glow highlight, lighter edge of an amber gradient |
| `amber-800` | `#8F5300` | derived | Attention on white: pending, arrears, till variance, unsynced |
| `amber-soft` | `#FFF1D9` | derived | Attention pill background on white |
| `paper` | `#F6F3EC` | derived | Application background. Warm, not blue-grey |
| `paper-dim` | `#ECE6D8` | derived | Card wells and recessed surfaces on paper |
| `sabon` | `#2F6B4F` | added | Confirmed only: paid, approved, checked in, synced |
| `sabon-soft` | `#E3F0E9` | derived | Confirmed pill background on white |
| `alert` | `#B02418` | added | Voided, rejected, failed, shortfall |
| `alert-soft` | `#FBE4E1` | derived | Alert pill background on white |
| `ink` | `#1B2440` | derived | Body text |
| `ink-2` | `#5A6079` | derived | Secondary text |

Measured contrast, all against their intended background:

| Pair | Ratio | Grade |
|---|---|---|
| white on navy-950 | 17.36 | AAA |
| navy-900 on white | 12.77 | AAA |
| white on navy-900 | 12.77 | AAA |
| amber-500 on navy-950 | 8.00 | AAA |
| amber-800 on paper | 5.57 | AA |
| sabon on white | 6.29 | AA |
| alert on white | 6.75 | AA |
| ink on paper | 13.80 | AAA |

**`amber-500` is never used for text on a light surface.** It fails outright there. The bright one lives on navy where it belongs and does its glowing; the dark one (`amber-800`) does the reading work on paper. Do not reach for the bright one on a light surface because it looks more like the logo.

Three rules that are not negotiable, unchanged from the first pass.

**Colour carries state, never decoration.** Amber means something needs attention. Sabon means confirmed. Alert means voided or failed. If a coloured element does not mean one of those things, it is the wrong colour.

**Colour is never the only signal.** Paid shows a tick and the word "Paid". A pending row shows a label, not just a coloured dot or a tinted pill alone.

**Wings are never colour-coded.** No pink for the women's wing, no blue for the men's. One identity across all three, distinguished by the M, W or Y already sitting in the member number, set in mono.

---

## 3. Type

Two voices now, not one: a serif with real character for anything that announces itself, a humanist sans for everything that has to be read fast in quantity.

- **Fraunces** for display: page titles, card titles, the wordmark, the check-in count's label. Warm, a little old, gives the interface the personality the logo's own linework has. Never for body copy, dense tables or form labels, it slows reading down exactly where speed matters.
- **Plus Jakarta Sans** for the interface: body copy, form fields, table cells, navigation. Contemporary and warm rather than mechanical, holds up small.
- **IBM Plex Sans Arabic** for Arabic. A true companion face, so the Arabic in the logo lockup and on printed receipts sits properly beside the Latin.
- **IBM Plex Mono** for figures only: amounts, member numbers, receipt numbers, references. Money must align on the decimal and member numbers must be comparable at a glance. Not for labels, headings or texture.

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
| (glow)   |  Members                          [+ Add member] |
|  LOGO    |  [ Active 2,301 ][ Pending 14 ][ Arrears 62 ]     |
|  o Members  [search.......................]  [wing v]       |
|    Approve  +---------------------------------------------+ |
|    Payments | AHL/M/2026/0113  Musa Bala    Men's  ●Active | |
|    Charity  | AHL/W/2026/0087  Zainab Sani  Women's ●Active| |
|    Attend   | AHL/Y/2026/0044  Idris Kabir  Youth  ▲Pending| |
+----------+--------------------------------------------------+
```

Rows, not cards, for the table itself, still the fastest thing to scan. But the surrounding chrome gets real depth: a soft shadow lifts each panel and stat card off the paper ground, corners round instead of squaring off, and the sidebar carries a faint amber glow behind the logo with a lit dot beside whichever section is current.

Fixed left rail, a `navy-950`-to-`navy-900` gradient, logo at the top. Rows 40px. Member numbers and amounts in mono, amounts right aligned. Status reads as a small tinted pill (word and icon together, never colour alone). Search focused on page load. Every list action reachable by keyboard with the shortcut visible in the interface.

### 4.2 Member area

Mid-range Android, slow connection, possibly an elderly member. A member has about four things to do, so this is not a dashboard.

Single column, 17px base, generous spacing, large tap targets, no sidebar. One warm navy-to-amber card carries the number that matters most (the outstanding balance); everything under it stays plain and readable. Plain language with no system vocabulary.

Keep the payload light. No chart libraries on member routes.

### 4.3 Check-in

This is where the identity does its work, and where all the boldness goes. Everything else stays disciplined so this can be loud.

```
+--------------------------------------------------+
| (logo) Jumu'ah, 18 September      ● 3 waiting     |
|                                                    |
|   [ search name or number..................... ]   |
|                                                    |
|   +--------------------------------------------+   |
|   | (photo)  Musa Bala                         |   |
|   |          AHL/M/2026/0113        [ Check in]|   |
|   +--------------------------------------------+   |
|                                                    |
|                  ╱‾‾‾╲                            |
|                 |  147 |     <- glowing, amber on navy |
|                  ╲___╱                            |
|                  checked in                        |
+--------------------------------------------------+
```

Full bleed, a deep `navy-950`. One oversized search field, always focused. Result rows minimum 64px, hittable with a thumb while standing. The running count sits inside an actual radial glow, the same way the logo's own crescent holds its lantern, not just set in an accent colour. It is the largest and only strongly lit element on the screen.

The offline state is permanently visible, never a toast that vanishes. Queued entries show a count in amber. On sync it turns `sabon` briefly, then goes quiet. That transition, and the glow's own slow pulse, are the only motion in the product; both respect `prefers-reduced-motion`.

---

## 5. Components

shadcn/ui as the foundation, then override the defaults.

- Radius a real 14px on cards, panels and inputs, 999px on pills and the check-in search bar. Not 4px, this is not meant to read as a government form.
- Real elevation. A soft, warm-tinted shadow lifts cards and panels off the paper ground; the sidebar and the check-in search bar carry a glow instead of a shadow, since they sit on navy rather than paper.
- Buttons: solid `navy-950` primary with a soft lift shadow, bordered secondary, `alert`-toned text destructive. No gradients on buttons; gradients are reserved for the sidebar, the check-in ground and the member area's one balance card, where they carry the light metaphor rather than decorate a control.
- Tables: sticky headers, tabular numerals, zebra striping off, hairline row separators, sitting inside a softly elevated panel rather than a bare bordered box.
- Status: a small pill with a soft tinted background, word and icon together, never colour alone.
- The logo appears in the admin rail, the login screen, the check-in header, the member portal header, the public landing page, the browser tab favicon, and on print. Nowhere else.

Motion is limited to what answers a click, the offline sync indicator, and the check-in glow's slow pulse. No entrance animations, no hover lift on every card. Respect `prefers-reduced-motion`.

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
- Colour never the only signal, tinted pills still carry a word and an icon
- Full keyboard operation of the admin desk
- Tested at 200 percent zoom
