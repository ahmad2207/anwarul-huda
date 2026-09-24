# Member home, admin member view, and face uniqueness

Extends `docs/MEMBER-INTERFACE.md` and `docs/SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md`. Read both first.

Three additions:

1. The member home screen carries more than money
2. An administrator opening a member sees everything about that member in one place
3. One face cannot belong to two accounts, and the system has to notice

---

## 1. Member home, expanded

The current home shows a balance and the latest content. That is thin for a member who attends weekly, serves on a committee and wants to know when the next ta'leem is.

The principle stays: a home screen is a summary with routes onward, not a dashboard. Every block answers either "what do I need to do" or "what is happening next". Anything that answers neither belongs on its own page.

Order is deliberate. Things needing action come first, because a member who has to scroll past a sermon to find out they are in arrears will not find out.

### 1.1 Needs your attention

Only rendered when something is actually outstanding. An empty attention block is not shown at all, not shown as "nothing to do".

- Outstanding balance, with what it is for and since when
- Record incomplete, with the next section
- Face check-in awaiting setup at the mosque
- A correction the office has asked them to make

### 1.2 What is next

The single most useful thing missing today. A member should open the app and know when to turn up.

- The next gathering they can attend: title, day, time, branch
- Their own role at it, if they have one. A member on the hospitality rota should see that here rather than hearing it on the day
- A second line for the one after, no more than two

Scoped to the member's own wing plus anything open to all wings.

### 1.3 Your attendance

- Gatherings attended this month, against how many were held
- When they last attended
- A link through to the full record

Present this as a count and a date, never as a percentage, a streak, a badge or a ranking. Attendance at worship is not a leaderboard, and gamifying it would be both distasteful and a reason for members to distrust the system.

### 1.4 Your service

Only when the member has service areas recorded.

- The areas they serve in
- Any upcoming duty, once rotas exist. Until then, just the areas

### 1.5 Latest

- The most recent announcement, if any is live
- The latest sermon
- This week's book

Announcements are already in the schema as a `ContentItem` type and are currently unused. They are the natural channel for "no ta'leem this Saturday", which is otherwise a WhatsApp broadcast nobody archives.

### 1.6 Keep it light

This is more content, not more weight. Every block is a small server-rendered summary. No charts, no client-side data fetching, no carousel. If the payload for `/account` goes past 150kb, something has gone wrong.

---

## 2. Administrator member record view

Today an administrator opening a member sees the record. They should see the member: everything the system knows, in one place, without going to four other screens.

Tabs on the member detail page.

### 2.1 Record

What exists now. The full Member Information Form, with an indicator of which sections the member has completed themselves and which were imported or entered on their behalf.

### 2.2 Attendance

Two views of the same data, because administrators ask two different questions.

**The log.** Every check-in: gathering title, type, date, the actual check-in time, the method used, and the officer who recorded it if manual. Sortable, filterable by date range and gathering type, exportable.

**The rollup.** By gathering type: Jumu'ah attended 31 of 44 held, ta'leem 12 of 20, general meetings 3 of 4. Over a selectable period. This is what someone is actually asking when they ask how often a member attends.

Also surface: last attended, longest gap, and whether they are enrolled for face check-in or checked in manually every time. That last one matters operationally, because a member checked in by hand every week is a member the office should offer to enrol.

### 2.3 Payments and contributions

- Every payment: date, amount, plan or fund, method, receipt number, who collected it, and the cash session it belonged to
- Voided payments shown in place, marked voided, with the reason and who voided them. Never hidden
- Contribution records: what was due per plan per period, what was paid, what is outstanding
- A running total and current arrears

### 2.4 Household

The household grid, with links through to any member who is also in the register.

### 2.5 Account and access

- Whether a login has been issued, when, and by whom
- Last login
- Whether the password has been changed from the temporary one
- Record completion progress by section
- Face enrolment status: enrolled, deferred, declined, or flagged. Never the embedding itself
- Any active lockout

### 2.6 Activity

The audit trail for this member: every change, who made it, when, and what changed. Both the member's own edits and administrator changes, distinguishable from each other.

### 2.7 One thing to restrict

If a member has been a charity beneficiary, that must not appear on this page for every wing administrator to see. It is visible to charity officers and super administrators only. A member's need is not general administrative context, and putting it on the default member view would be a real breach of their dignity.

---

## 3. Face uniqueness

One face, one account. The system has to detect an attempt to enrol a face that is already enrolled to someone else.

But there are two distinct problems here, and only one of them is fraud.

### 3.1 The two cases

**A duplicate account.** The same person enrolling twice, under two member numbers. Either a genuine duplicate in the register, which the roll already has several of, or someone deliberately holding two accounts.

**Two people the system cannot tell apart.** Identical twins, or siblings close enough to score above the matching threshold. In a community organisation full of families, this is not hypothetical.

The detection is the same. The handling is not, and conflating them would mean accusing two brothers of fraud.

### 3.2 Detection at enrolment

Before a new embedding is saved, search existing enrolments for a match.

- Match to the **same member**: this is re-enrolment. Replace the existing embedding.
- Match to a **different member**: do not save. Create a review case. Tell the enrolling member only that setup could not be completed and the office will help them, and nothing else.
- No match: save normally.

**Never tell the member who they matched.** Revealing that their face resembles another named member is a privacy breach against that other person, and in the fraud case it tells the person exactly what they need to know to try again differently.

### 3.3 The threshold is not the check-in threshold

Instinct says use a stricter threshold for duplicate detection than for check-in. That is wrong here, and the reasoning matters.

If two enrolled faces score above the check-in threshold against each other, then check-in cannot reliably tell those two members apart. That is a problem whether or not anyone is committing fraud. Attendance would be silently attributed to the wrong person, which is worse than a failed check-in because nobody would ever notice.

So duplicate detection runs at the check-in threshold or slightly below it. Anything that could confuse check-in gets flagged, and the review decides which of the two cases it is.

### 3.4 Match margin at check-in

Related, and easy to miss. At check-in, the server should compute the best match and the runner-up. If the gap between them is small, refuse the match and fall back to manual, rather than confidently picking the higher score.

A confident wrong answer is worse than no answer. Log the margin on every face check-in so this can be tuned with real data in B3.

### 3.5 Resolution

A review queue for flagged pairs, super administrator and attendance officer only. For each, the two members and the similarity score, with no images and no embeddings shown.

Three outcomes:

1. **Same person, duplicate account.** Merge or deactivate one record. The surviving record keeps the enrolment. Merging needs its own care, since payments, attendance and household links all point at the losing record.
2. **Different people, genuinely.** Mark the pair as indistinguishable. Both are excluded from face check-in permanently and checked in by name from then on. Neither is treated as an incomplete record, and neither is prompted about face again.
3. **Not a real match.** Dismiss, and allow the enrolment to proceed.

Every outcome is audited with who decided and why.

### 3.6 Retrospective scanning

New enrolments are checked against existing ones, but the threshold will be tuned in B3, and a tuned threshold changes what counts as a match. So there must be a way to re-run the comparison across all enrolled pairs and surface anything the old threshold missed.

Super administrator only, run on demand, results into the same review queue.

### 3.7 What this does not do

This detects a face already in the system. It does not detect a photograph held up to a camera, which is what the liveness and anti-spoofing checks in B1 are for, and it does not verify that a face belongs to the person whose name is on the record. A member could still enrol someone else's face at first setup. Officer-assisted enrolment at the mosque is the control for that, which is another reason it should be the preferred path rather than the fallback.

---

## 4. Build prompts

### H1: Member home, expanded

```
Read docs/MEMBER-HOME-AND-ADMIN-VIEW.md section 1, docs/MEMBER-INTERFACE.md section 3, and docs/DESIGN.md section 4.2.

Expand the member home screen. The complete state only. The incomplete state stays exactly as it is, showing only the completion task.

1. "Needs your attention", rendered only when something is outstanding: balance with what it is for and since when, record incomplete, face awaiting setup at the mosque, any correction the office has requested. When nothing is outstanding, render nothing. Do not show an empty state saying there is nothing to do.
2. "What is next": the next gathering the member can attend, with title, day, time and branch, plus their own role at it if they have one. A second line for the one after. No more than two. Scoped to their wing plus gatherings open to all wings.
3. "Your attendance": gatherings attended this month against how many were held, and when they last attended, with a link to the full record. A count and a date only. No percentage, no streak, no badge, no ranking. Attendance at worship is not a leaderboard and must not be presented as one.
4. "Your service": their service areas, only if any are recorded.
5. "Latest": the most recent live announcement, the latest sermon, this week's book. ContentItem already has an ANNOUNCEMENT type that is currently unused. Wire it up, including an admin route to create one.
6. Order on the page is attention, next, attendance, service, latest. A member must not have to scroll past a sermon to find out they are in arrears.
7. Every block is a small server-rendered summary. No charts, no client-side fetching, no carousel. Report the payload for /account and justify anything over 150kb.

Show me the attention block and the next-gathering query before building the rest.
```

### H2: Administrator member record view

```
Read docs/MEMBER-HOME-AND-ADMIN-VIEW.md section 2.

Rebuild the administrator member detail page as tabs, so everything known about a member is in one place.

1. Record: as it is now, plus an indicator per section of whether the member completed it themselves or it was imported or entered on their behalf.
2. Attendance, two views. The log: every check-in with gathering, type, date, actual check-in time, method, and the recording officer where manual. Filterable by date range and gathering type, exportable. The rollup: attended against held, by gathering type, over a selectable period. Also surface last attended, longest gap, and whether they are enrolled for face or checked in manually every time.
3. Payments and contributions: every payment with date, amount, plan or fund, method, receipt number, collecting officer and cash session. Voided payments shown in place, marked voided, with reason and who voided. Never hidden. Contribution records showing due, paid and outstanding per plan per period, with a running total and current arrears.
4. Household, with links through to any household member who is also in the register.
5. Account and access: login issued and by whom, last login, whether the temporary password was changed, record completion by section, face enrolment status, any active lockout. Never the embedding.
6. Activity: the audit trail for this member, with the member's own edits distinguishable from administrator changes.
7. Charity beneficiary history must NOT appear on this page for wing administrators. Charity officers and super administrators only. A member's need is not general administrative context.

Wing scoping applies to the whole page. Confirm a super admin with no wing assignment sees all wings.

Show me the attendance rollup query and the charity visibility restriction before building the rest.
```

### F1: Face uniqueness

```
Read docs/MEMBER-HOME-AND-ADMIN-VIEW.md section 3 in full, including 3.3 and 3.7. Build after B1's save path exists.

One face cannot belong to two accounts. Detect it, and handle the two cases it produces differently.

1. Before saving a new embedding, search existing enrolments for a match.
   - Same member: re-enrolment, replace the existing embedding.
   - Different member: do not save. Create a review case. Tell the member only that setup could not be completed and the office will help. Never reveal who they matched, to anyone but an administrator.
   - No match: save normally.

2. Run detection at the check-in threshold or slightly below it, not above. If two enrolled faces score above the check-in threshold against each other, check-in cannot tell those members apart, and attendance would be silently attributed to the wrong person. That is a problem regardless of whether anyone is committing fraud. Read section 3.3 before choosing a value.

3. Add match margin to check-in: compute the best match and the runner-up. If the gap is small, refuse and fall back to manual rather than confidently choosing the higher score. Log the margin on every face check-in so B3 can tune it on real data.

4. Review queue, super administrator and attendance officer only. Shows the two members and the similarity score. No images, no embeddings. Three outcomes:
   - Same person, duplicate account: merge or deactivate one. The surviving record keeps the enrolment. Tell me what merging needs to handle, since payments, attendance and household links all point at the losing record. Do not build the merge until I have seen that list.
   - Different people: mark the pair indistinguishable. Both are excluded from face check-in permanently, checked in by name from then on, neither treated as incomplete, neither prompted about face again.
   - Not a real match: dismiss and allow enrolment.
   Every outcome audited with who decided and why.

5. Retrospective scan, super administrator only, on demand, comparing all enrolled pairs and feeding the same review queue. The threshold will change in B3, and a changed threshold changes what counts as a match.

6. Do not claim this prevents impersonation. It detects a face already in the system. It does not verify that a face belongs to the person named on the record.

Show me the detection threshold reasoning and the review queue before wiring it into enrolment.
```

---

## 5. What not to do

- Do not present attendance as a streak, a percentage, a badge or a leaderboard anywhere in the member interface.
- Do not tell a member which other member their face matched.
- Do not show charity beneficiary history on the general member view.
- Do not use a stricter threshold for duplicate detection than for check-in. Read 3.3.
- Do not let check-in pick the higher of two close scores. Refuse and fall back.
- Do not hide voided payments. They stay visible, marked, with the reason.
- Do not build the duplicate merge before listing everything that points at the record being merged away.
