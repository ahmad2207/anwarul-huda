# Member interface

Supersedes sections 1.1, 1.2, 2.1, 2.2 and 2.3 of `docs/SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md`, including the four-method attendance table in 1.2. The face recognition mechanics in sections 3 and 4 of that document stand unchanged, and section 4 on data protection still applies in full.

Face recognition is the attendance method. Enrolment is a step in the member's own record, not an optional extra.

Read `docs/DESIGN.md` section 4.2 alongside this.

---

## 1. What changed and why it matters

Two decisions, with consequences beyond the obvious.

**The registration form leaves the admin area entirely.** Administrators no longer enter member records. They approve, correct and administer. Members enter their own details. This is the right call: 289 imported records need completing, and the person who knows the answers is the member, not an officer typing from a form.

The consequence is that the member interface stops being a small portal and becomes the main data entry surface of the whole system. It carries the full Member Information Form, on a phone, on a slow connection, for an audience that includes elderly members. It now deserves more design attention than the admin desk, not less.

**Login moves from phone number to member number.** This solves the problem that blocked bulk credential issue, because every imported member already has a member number and almost none have a phone. Credentials can be issued for all 289 on day one.

It brings two costs that must be designed around.

*Member numbers are public and enumerable.* They appear on printed cards and follow a predictable sequence. The username is therefore not a secret, which phone numbers partly were. The password and the rate limiting are now the entire defence. Lockout after repeated failures is required, not optional.

*Password recovery has no channel.* With phone login, a reset could be sent by SMS. With member number login and no phone on file, a member who forgets their password must go to the office. That is acceptable at the start and unacceptable at scale, which is why the completion flow asks for a phone number early and explains that it is what allows self-service reset later. Once a verified phone is on file, SMS reset becomes available to that member.

---

## 2. Credential issue, revised

Administrators issue credentials in bulk from the member list, with no phone number required.

- Username is the member number, `AHL/M/2026/0113`.
- Input is normalised on submit: strip spaces, slashes and dashes, uppercase. So `ahl m 2026 0113` and `AHLM20260113` both resolve. Nobody should fail to log in over punctuation.
- Temporary password: 10 characters, unambiguous alphabet with no 0, O, l, 1 or I, because it will be read aloud and copied by hand.
- Shown to the administrator exactly once at generation. Hashed like any password. Never retrievable. Lost means reissue.
- `mustChangePassword` true until changed.
- Output is a printable slip, eight to an A4 page, carrying the logo, the member name, the member number and the temporary password. The slip is what gets handed out after Jumu'ah.

Rate limiting and lockout on the login route are part of this work, not a later hardening pass.

---

## 3. The member interface

### 3.1 Shape

Single column, no sidebar, 17px base, 44px touch targets. A fixed bottom navigation bar with four destinations, because it is thumb-reachable and visible, which a hamburger menu is not. Settings sits in the header, not the bar.

```
+--------------------------------+
|  Anwaru-l-Huda          [⚙]    |
|                                |
|                                |
|          content               |
|                                |
|                                |
+--------------------------------+
| Home   Record   Payments  Books|
+--------------------------------+
```

| Route | What it is |
|---|---|
| `/account` | Home. Changes shape depending on whether the record is complete |
| `/account/record` | The Member Information Form, in sections, view and edit |
| `/account/payments` | Balance, contribution history, receipts |
| `/account/library` | Sermons and the weekly book |
| `/account/attendance` | Own attendance record |
| `/account/face` | Face check-in setup, and re-enrolment if it stops working |
| `/account/settings` | Password, phone, notification preferences |

Attendance and face are reached from Home and from the record, not from the bottom bar. Four bars is the limit before the labels stop being readable at 17px.

### 3.2 Home, before the record is complete

The completion task is the whole page. Nothing competes with it.

```
+--------------------------------+
|  Assalamu alaikum, Musa        |
|                                |
|  Your record is 2 of 9 done    |
|  [====----------------]        |
|                                |
|  Next: your contact details    |
|  [  Continue  ]                |
|                                |
|  Why we are asking             |
|  The league is building a      |
|  complete record of every      |
|  member. Only the office can   |
|  see what you enter.           |
+--------------------------------+
```

Progress is honest and section-based, not a percentage invented from field counts. The explanation stays visible until the record is complete, because a member who does not understand why is a member who will not finish.

No balance, no library, no distractions on this screen. They arrive when the record is done.

### 3.3 Home, once complete

```
+--------------------------------+
|  Assalamu alaikum, Musa        |
|  AHL/M/2026/0113               |
|                                |
|  Outstanding                   |
|  ₦2,500.00                     |
|  Monthly dues, September       |
|  [  View payments  ]           |
|                                |
|  Face check-in    ● Ready      |
|  Set up 14 September            |
|                                |
|  Latest                        |
|  Friday khutbah, 12 September  |
|  This week's book              |
+--------------------------------+
```

### 3.4 The record, section by section

One section per screen. Never a single long scroll, because a dropped connection halfway through a twelve-field form loses everything and the member does not try again.

Nine sections. The first eight match the paper form. The ninth is face check-in, which the paper form could not do.

1. Your name
2. About you
3. Contact details
4. Household
5. Your membership
6. Service and skills
7. Next of kin
8. Consent
9. Face check-in

Each saves on its own and can be left and resumed. Each screen shows where it sits in the sequence. A member can jump to any section from a contents view rather than being forced through in order, because someone who only wants to correct their phone number should not walk through eight screens.

**Section 1 is the important one.** The member sees their name exactly as it appeared on the roll and splits it themselves.

```
+--------------------------------+
|  1 of 9: Your name             |
|                                |
|  On our records you appear as: |
|  +--------------------------+  |
|  | Imam Suleiman Sa'ad      |  |
|  +--------------------------+  |
|                                |
|  Our old register wrote names  |
|  in different orders, so we    |
|  need you to tell us which     |
|  part is which.                |
|                                |
|  Title                         |
|  [ Imam                     ]  |
|                                |
|  Surname                       |
|  [                          ]  |
|                                |
|  First name                    |
|  [                          ]  |
|                                |
|  Other names                   |
|  [                          ]  |
|                                |
|  [  Save and continue  ]       |
+--------------------------------+
```

The title is prefilled from the roll where one was found. `fullNameAsWritten` is never overwritten, so the original is always recoverable.

**Section 9 is face check-in.** It carries its own consent, separate from section 8, because biometric data is not covered by a general records consent.

```
+--------------------------------+
|  9 of 9: Face check-in         |
|                                |
|  How you will be marked        |
|  present at gatherings.        |
|                                |
|  What we keep                  |
|  A mathematical pattern from   |
|  your face. Not a photograph.  |
|  The pictures never leave      |
|  your phone.                   |
|                                |
|  Used only to mark you present |
|  You can remove it any time    |
|                                |
|  [ ] I agree to this           |
|                                |
|  [  Set up now  ]              |
|  [  I cannot do this now  ]    |
+--------------------------------+
```

The second button is not a decline. It defers, sets `faceEnrolmentDeferred` on the member, and puts them on a worklist for the office to enrol them at the mosque. The member sees a plain line saying the office will help them at the next gathering.

Deferral has to exist and has to be tracked, because a member with an old phone, no working camera, too little data to download the models, or who simply needs help will otherwise be stuck with an unfinishable record and no way to be marked present. A deferral that goes into a worklist is an operational task. An optional step that gets skipped is a hole in the register.

The record can complete with section 9 deferred. It cannot complete with section 9 untouched.

**Section 3 asks for the phone number early and says why.** Not "required field", but a plain sentence: this is how you reset your own password and how the office reaches you. That is a reason a member acts on.

Read-only to the member, editable by administrators only: wing, membership status, member number, office held. Show them, greyed, with a line saying the office can change them. A member who thinks their wing is wrong needs to see that it is wrong.

### 3.4b Members who cannot use face recognition

Face is the method. It will still fail for some members, and the system has to record their attendance anyway.

Three cases, all real:

1. A member who observes niqab and will not uncover for a camera. On this roll, 168 of 289 members are women, so this is not an edge case.
2. A member whose phone cannot run the enrolment, or who has no smartphone at all.
3. A member enrolled successfully whose face does not match on the day, because of lighting, a cap, or the angle.

The answer for all three is the same and costs nothing to build, because it already exists: the attendance officer checks them in by name from the search field on the check-in screen. That is not a parallel system, it is the officer doing their job when the camera does not resolve it.

Two things follow:

- Manual check-in by an officer stays on the check-in screen permanently. It is not a fallback to be removed once face works.
- The women's wing will need a female attendance officer able to check members in by name. That is an operational arrangement for the committee, not a feature, but the system should not be designed as if it were unnecessary.

A member who is checked in manually every week is not shown any prompt, badge or reminder about setting up face. Their record is complete and their attendance is recorded. Nothing in the interface treats them as unfinished.

### 3.5 Editing after completion

The record stays open. A member can change their details at any time from the same sectioned view, now in view mode with an edit action per section.

Changes to phone, address and name raise a light notification to the wing administrator rather than requiring approval. Members correcting their own contact details is the point of the exercise, and putting an approval gate in front of it will stop it happening.

Every change is written to the audit log with the member as the actor.

### 3.6 First login

1. Log in with member number and temporary password
2. Forced password change, no other route reachable
3. A single welcome screen explaining what the account is for, dismissible once
4. Straight into section 1 of the record

Do not show the empty account area before the record is started. A member who lands on a blank dashboard leaves.

### 3.7 Language and tone

The audience spans a wide age range and is not technical.

- "Your record", not "your profile". "Payments", not "transactions". "Books", not "resources".
- Greeting is "Assalamu alaikum", not "Welcome back".
- Every field has a real label above it, never a placeholder standing in as one.
- Errors name the field and say what to do.
- No em dashes.

---

## 4. What the admin area loses and keeps

**Removed:** the administrator-facing new member form, and admin editing of member-owned fields.

**Kept, and still needed:**

- Member list, search and detail view, read and correct
- Approval queue for self-registrations from outside the roll
- Credential issue and reissue
- Wing, status, member number and office held, which only administrators set
- The incomplete-records view, now a progress monitor rather than a data entry queue: who has logged in, who has started, who has finished, who has never logged in. That last group is the list the office chases.
- CSV import, unchanged

An administrator must still be able to correct a member's record, because some members will never log in and someone will have to enter their details from a paper form. The difference is that this is now the exception path, not the main one.

---

## 5. Build prompts

### M1: Login and credential issue

```
Read docs/MEMBER-INTERFACE.md sections 1 and 2. This supersedes prompt A1 in the accounts addendum.

Build credential issue and login using member number as the identifier.

1. Add to User: mustChangePassword (Boolean, default false), temporaryPasswordIssuedAt, temporaryPasswordIssuedById. Generate the migration.
2. Login identifier is the member number. Normalise input on submit: strip spaces, slashes and dashes, uppercase, then match. "ahl m 2026 0113" and "AHLM20260113" must both resolve to AHL/M/2026/0113.
3. Bulk credential issue from the member list. No phone number required. Generate a 10 character temporary password from an alphabet excluding 0, O, l, 1 and I. Hash it. Show each one to the administrator exactly once at generation, never retrievable afterwards. Set mustChangePassword true.
4. Printable slips, eight to an A4 page, following docs/DESIGN.md section 7: logo, member name, member number, temporary password. This is what gets handed out after Jumu'ah.
5. Reissue invalidates the previous temporary password and is audited separately.
6. mustChangePassword true redirects to the password change screen from every route including direct URL entry.
7. Rate limiting and lockout on the login route. Member numbers are printed on cards and follow a predictable sequence, so the username is public. The password is the only defence and it must be defended. Tell me the lockout policy you implemented and why.
8. Audit every issue, reissue and first password change. Never store a temporary password in plain text anywhere, including the audit log.

Show me the member number normalisation, the lockout policy and the audit entries before building the print output. Pause there.
```

### M2: Member shell and home

```
Read docs/MEMBER-INTERFACE.md section 3 and docs/DESIGN.md section 4.2.

Build the member shell and home screen. No form sections yet.

1. Member layout: single column, no sidebar, 17px base, fixed bottom navigation with four destinations (Home, Record, Payments, Books), settings in the header. 44px minimum touch targets throughout.
2. /account home is state aware. If the record is incomplete, the completion task is the entire page: greeting, honest section-based progress, the next section, a continue action, and the plain-language explanation of why. No balance, no library, nothing else.
3. If the record is complete, home shows the greeting and member number, outstanding balance with what it is for, face check-in status (ready, or awaiting setup at the mosque), and the latest sermon and book.
4. First login sequence: forced password change, then one dismissible welcome screen, then straight into section 1 of the record. Never show an empty account area to a member who has not started.
5. Keep this route group light. No admin components, no chart library, no heavy dependencies. Tell me the JavaScript payload for /account and justify anything over 150kb.

Presentation follows DESIGN.md. Show me the two home states and the bottom navigation before building anything else.
```

### M3: The record

```
Read docs/MEMBER-INTERFACE.md sections 3.4 and 3.5.

Build the member record: the full Member Information Form, owned by the member.

1. Nine sections as listed in 3.4, one section per screen. Never a single long scroll.
2. Each section saves independently and is resumable. Assume the connection drops mid-form, because it will.
3. A contents view lets a member jump to any section rather than walking through in order.
4. Section 1 shows fullNameAsWritten exactly as it came from the roll and asks the member to split it into title, surname, first name and other names. Prefill the title where the import found one. Never overwrite fullNameAsWritten.
5. Section 3 asks for the phone number with a plain sentence explaining that it is how they reset their own password and how the office reaches them.
6. Wing, membership status, member number and office held are shown greyed and read-only, with a line saying the office can change them. Enforce read-only on the server, not by disabling the input.
7. On completion, clear isRecordIncomplete and raise a light review task for the wing administrator. This is a review, not an approval. An imported member is already a member and their status does not change.
8. After completion the record stays editable in the same sectioned view, in view mode with an edit action per section. Changes to phone, address and name notify the wing administrator without gating the change behind approval.
9. Every change writes to the audit log with the member as the actor.
10. Section 9 is face check-in. Build the screen, the separate consent and the deferral path in this prompt. The capture itself comes from prompt B1, so leave a clear integration point rather than stubbing a fake camera.
11. Add faceEnrolmentDeferred (Boolean) and faceEnrolmentDeferredAt to Member. Deferring completes the section and adds the member to an office worklist. The record can complete with section 9 deferred. It cannot complete with section 9 untouched.

Validate on the server with Zod. Show me section 1, section 9 and the save-and-resume behaviour before building the remaining sections.
```

### M4: Remove the admin registration form

```
Read docs/MEMBER-INTERFACE.md section 4.

Members now own their own records. Remove the administrator-facing registration form and rescope the admin member area.

1. Remove the admin new member form and any admin route that creates a member record from scratch, other than CSV import.
2. Administrators keep: member list and search, member detail read view, correcting a record as an exception path, wing, status, member number and office held.
3. Convert the incomplete-records view into a progress monitor: who has never logged in, who has logged in but not started, who is part way through with which section, who has finished. The never-logged-in list is what the office chases, so make it the default filter and make it exportable.
4. Keep an administrator correction path for members who will never log in. Label it clearly as entering details on behalf of a member, and audit it as such so it is distinguishable from a member's own edit.
5. Self-registration from outside the roll still exists at /register and still goes to the approval queue. Do not remove that.

List every route you removed or changed before making the changes. Pause there.
```

---

### M5: Officer-assisted enrolment and the enrolment worklist

```
Read docs/MEMBER-INTERFACE.md sections 3.4a and 3.4b. Build after B1, since it reuses the capture.

1. Enrolment worklist at /admin/attendance/enrolment, showing members with faceEnrolmentDeferred true, and members who have never enrolled, filterable by wing. This is the list the office works through at gatherings.
2. Officer-assisted enrolment: an officer opens a member from the worklist and runs the capture on their own device with the member present. Record who assisted and when.
3. Assisted enrolment still requires the member's consent, captured at that moment by the officer confirming the member agreed, and audited. Do not let an officer enrol a member without it.
4. A member can be marked "will not use face check-in" by an officer. This removes them from the worklist permanently, clears the deferral, and is not treated as an incomplete record anywhere in the system. They are checked in by name from then on.
5. The worklist must never be presented to members. It is an office task list, not a compliance score.

Show me the consent capture for assisted enrolment before building the worklist.
```

## 6. What not to do

- Do not put the whole form on one scrolling page.
- Do not gate a member's own contact detail corrections behind administrator approval.
- Do not let a member change their own wing, status, member number or office held.
- Do not show a blank account area to a member who has not started their record.
- Do not overwrite `fullNameAsWritten`. It is the link back to the source roll.
- Do not ship the login without rate limiting. The username is public.
- Do not remove manual check-in by name from the officer's screen. It is how members who cannot use face are recorded, permanently.
- Do not show a member any prompt, badge or reminder about face enrolment once they have deferred or declined. The office chases it, not the interface.
- Do not let a record be blocked from completing because face enrolment could not be done on the member's phone.
