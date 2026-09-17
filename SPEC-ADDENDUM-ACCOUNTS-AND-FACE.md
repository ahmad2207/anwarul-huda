# Addendum: member accounts and face recognition attendance

Extends `docs/SPEC.md`. Read that first, plus section 5 on biometrics, which this partly supersedes.

---

## 1. Two problems to solve before building

### 1.1 The imported members have no phone numbers

The plan is that imported members log in with their phone number. The nominal roll has an address column and a phone column, and both are empty for all 289 rows. So there is nothing to log in with and nothing to send a password to.

This is not a small gap. It means accounts cannot be created in bulk at import time for anyone on the roll.

The fix is to make credential issue a deliberate act rather than a batch job:

1. Import creates the member record with `isRecordIncomplete` true and no user account.
2. When the league obtains a member's phone number, whether from a paper form, at the mosque, or from the wing's own WhatsApp list, an administrator enters it and issues credentials from that member's page.
3. Issuing generates a temporary password and produces a printable slip and a WhatsApp-ready message.
4. The member logs in, is forced to change the password, then completes their own record.

An administrator can issue credentials in bulk for any members who already have a phone on file, so once numbers start arriving the work is one action for many members, not one at a time.

This sequencing has a side benefit. The act of issuing credentials is what confirms a phone number is real and belongs to that person, which is exactly the verification a self-service account needs.

### 1.2 Face recognition will not work for every member

**Superseded by `docs/MEMBER-INTERFACE.md` section 3.4b. Read that instead.**

In short: face recognition is the attendance method, enrolment is section 9 of the member's own record, and manual check-in by name stays permanently on the officer's screen for members for whom face does not or cannot work. QR codes are not part of the design.

---

## 2. Module A: member accounts

### 2.1 Credential issue

Administrators issue, never members themselves, because there is no verified contact channel to self-serve against yet.

- Username is the phone number in E.164. Email optional and can be added later by the member.
- Temporary password is randomly generated, 10 characters, unambiguous alphabet with no 0, O, l, 1 or I, because it will be read aloud and copied by hand.
- `mustChangePassword` is set true. The member cannot reach any other page until it is changed.
- The temporary password is hashed like any other. It is shown to the administrator exactly once, at the moment of generation, and is never retrievable afterwards. If it is lost, reissue.
- Issuing writes to the audit log: who issued, for which member, when.
- Output is a printable slip and a copyable WhatsApp message.

A reissue invalidates the previous temporary password.

### 2.2 First login and record completion

After the forced password change, a member with `isRecordIncomplete` true goes to a guided completion flow rather than to `/account`.

The flow presents the paper Member Information Form section by section, prefilled with whatever the import captured. The name is the important part: the member sees their name exactly as it appeared on the roll and is asked to split it into surname, first name and other names themselves. This is the correct place to solve the name-order problem, because the member knows the answer and nobody else reliably does.

Sections: name and identity, contact, household, membership details, service and skills, next of kin, consent. Each is savable on its own so the flow survives a dropped connection, which it will.

On completion, `isRecordIncomplete` clears and the record goes to the wing administrator for a light review, not a full re-approval. Imported members are already members.

A member can return and edit their own record at any time. Certain fields are administrator-only and read-only to the member: wing, membership status, member number, office held.

### 2.3 What a member can do once complete

This settles the earlier question about the member area:

- See outstanding balance and full contribution history, with receipts
- See and edit their own record, with an edit history
- Set up, re-do or remove their face check-in, and see their own attendance record
- See their own attendance record
- Browse sermons and the weekly book
- Change password

Not included by default, because they are committee decisions: the member directory, charity fund visibility, and whether service areas are member-editable or administrator-only.

---

## 3. Module B: face recognition attendance

### 3.1 How it works

Enrolment happens on the member's own phone, in their account. Check-in happens on the attendance officer's phone, against the gathering.

1. The member opens face enrolment and consents explicitly, with a plain explanation of what is stored.
2. The browser captures several frames, runs a liveness check that requires a small movement, and computes a face embedding on the device.
3. Only the embedding is sent to the server. The images never leave the phone.
4. At check-in, the officer's camera computes an embedding of whoever is in frame and the server matches it against enrolled members scoped to that gathering's wing and branch.
5. A match above the confidence threshold checks the member in. Below it, the officer checks the member in by name from the search field.

### 3.2 What is stored, and what is not

**Stored:** one or more face embeddings per member, as vectors. The consent record, with timestamp. The enrolment device and date.

**Never stored:** the enrolment photographs, the check-in camera frames, or any image of a face captured for recognition. Frames are processed in memory on the device and discarded. The member photograph on their profile is a separate thing entirely, with its own separate consent, and is never used for recognition.

An embedding is not reversible into a recognisable photograph, which is why this boundary is worth holding precisely.

### 3.3 Stack

- **Embedding and liveness in the browser:** vladmandic/human. Actively maintained, MIT, runs on TensorFlow.js, and includes both face description and an anti-spoofing check in one library. Lazy load it, because the models are several megabytes and most members are on mobile data. Never load it on any route other than enrolment and check-in.
- **Storage and matching:** pgvector on Supabase, with an index on the embedding column. Matching is server-side, scoped to the gathering's wing and branch, which keeps the candidate set small.
- **Threshold:** cosine similarity, tuned empirically. Do not accept a number from documentation. Build a calibration screen that runs known members against known embeddings and reports false accepts and false rejects at a range of thresholds, then pick from real data collected at the actual mosque, in the actual lighting.

### 3.4 Anti-spoofing

Without a liveness check, a photograph held up to the camera will check someone in. Since attendance may be tied to contributions and standing, that matters.

Require a randomly chosen small action at both enrolment and check-in, such as turning the head or blinking, and run the library's anti-spoofing score as a second gate. Log the liveness score with every face check-in so a pattern of marginal passes is visible later.

### 3.5 Failure behaviour

The check-in screen never dead-ends on a face failure. No match after a short attempt drops straight into the search field with the camera still running. The officer should never have to think about which method they are using.

Offline: face matching needs the server, so face check-in is unavailable offline. Manual search must continue to work offline exactly as specified in Phase 5, and becomes the only method while the connection is down. The screen says so plainly rather than appearing broken.

---

## 4. Data protection

Face embeddings are biometric data, which the Nigeria Data Protection Act 2023 treats as sensitive personal data. Storing them brings obligations that storing a phone number does not. This is a real change from the terminal approach in `SPEC.md` section 5, where the device held the templates and this system held only an ID mapping. That protection is given up by moving recognition in-app, deliberately, in exchange for self-enrolment and no hardware cost.

Build these in from the start, not later:

1. **Explicit, separate, informed consent.** Not bundled with membership consent, not a pre-ticked box. The member reads what is stored and what it is used for, and opts in.
2. **Withdrawal that works.** A member can delete their face enrolment from their own account at any time, in one action, with no explanation required and no administrator involved. Deletion removes the embeddings immediately, not on a soft-delete flag.
3. **Purpose limitation.** Embeddings are used for attendance matching and nothing else. No search by face, no identifying a person in a photograph, no export.
4. **Access control.** No administrator role can view or export embeddings. They are not visible in any admin screen, any report or any CSV.
5. **Retention.** Embeddings are deleted when a member becomes inactive or deceased, and on withdrawal. Write the retention rule into the code, not into a document.
6. **Audit.** Enrolment, withdrawal and every face check-in are logged.
7. **Minors.** The youth wing may include members under 18. Do not enrol anyone under 18 in face recognition without a separate decision from the committee about guardian consent.

Have the committee sign off on a short written statement of what is collected and why, and give members a copy at enrolment. That is worth doing regardless of what the law strictly requires.

---

## 5. Build prompts

Run in order. Module A before Module B, because accounts are what face enrolment hangs off.

### A1: Credential issue

```
Read docs/SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md sections 1.1 and 2.1, and the User and Member models.

Build administrator credential issue for imported members. No self-service registration in this step.

1. Add to User: mustChangePassword (Boolean, default false), temporaryPasswordIssuedAt, temporaryPasswordIssuedById.
2. On a member's admin page, an "Issue login" action. It requires a phone number on the member record. If there is none, the action is disabled and says so, with a field to add one.
3. Generate a 10 character temporary password from an unambiguous alphabet excluding 0, O, l, 1 and I. Hash it like any password. Show it to the administrator exactly once, on screen, and never again. Set mustChangePassword true.
4. Produce two outputs: a printable slip carrying the logo, the member name, member number, phone and temporary password, and a copyable WhatsApp message with the same.
5. Reissue invalidates the previous temporary password and is logged separately from first issue.
6. Bulk issue: from the member list, select members who have a phone on file and issue for all of them, producing one printable sheet of slips. Members without a phone are excluded and listed.
7. Login by phone number in E.164, normalising local format on input. A user with mustChangePassword true is redirected to the password change screen from every route until it is changed.
8. Audit every issue, reissue and first password change.

Never log, email or store a temporary password in plain text anywhere, including in the audit log.

Show me the password generation, the forced change redirect and the audit entries before building the print output. Pause there.
```

### A2: Self-service record completion

```
Read sections 2.2 and 2.3 of the addendum, and docs/DESIGN.md section 4.2.

Build the member record completion flow and the member account area.

1. After a forced password change, a member with isRecordIncomplete true goes to /account/complete rather than /account.
2. The flow follows the paper Member Information Form section by section, prefilled from the import. Each section saves independently and the member can leave and return. Assume the connection will drop.
3. The name step shows fullNameAsWritten exactly as it came from the roll and asks the member to split it into surname, first name and other names. Explain in one plain sentence why we are asking.
4. Fields that are administrator-only and read-only to the member: wing, membership status, member number, office held.
5. On completion, clear isRecordIncomplete and raise a light review task for the wing administrator. This is a review, not a re-approval. An imported member is already a member and their status does not change.
6. Superseded by prompts M2 and M3 in docs/MEMBER-INTERFACE.md. Build the member area from those instead.
7. Do not build the member directory, charity visibility or member-editable service areas. Those are pending a committee decision.
8. Member area at 17px base, single column, 44px touch targets, light payload. No admin components.

Presentation follows DESIGN.md. Show me the completion flow and the name splitting step before building the account area. Pause there.
```

### B1: Face enrolment

```
Read section 3 and all of section 4 of the addendum. Section 4 is not advisory.

Build face enrolment in the member's own account.

1. Add pgvector to the database. Add a FaceEnrolment model: memberId, embedding (vector), livenessScore, enrolledAt, deviceLabel, isActive. Index the embedding column.
2. Add to Member: consentFaceRecognition (Boolean, default false) with consentFaceRecognitionAt.
3. Enrolment is section 9 of the member record, built in prompt M3. This prompt supplies the capture, the consent gate and the storage behind it. Also expose /account/face for later re-enrolment and removal. Consent is separate from the general records consent, on its own screen, not bundled, not pre-ticked.
4. Use vladmandic/human, lazy loaded on this route only. Capture several frames, require a randomly chosen liveness action, compute the embedding on the device.
5. Send only the embedding to the server. No image is uploaded, written to disk, or held after the frame is processed. Verify this and tell me exactly where frames are discarded.
6. Withdrawal: one action in the member's account deletes all their embeddings immediately, hard delete, no confirmation beyond a single are-you-sure, no reason required, no administrator involvement.
7. No administrator role can view, export or download an embedding. There is no admin screen that shows one. Confirm this holds across every existing report and CSV export.
8. Delete embeddings automatically when a member status becomes INACTIVE or DECEASED.
9. Do not allow enrolment for any member under 18. Block it and explain why.
10. Audit enrolment and withdrawal.

A member who defers or declines enrolment must see no prompt, badge, banner or reminder anywhere in the member area. The office chases enrolment through its own worklist, built in prompt M5.

Show me the consent screen copy and the exact point where camera frames are discarded, before building the matching in B2. Pause there.
```

### B2: Face check-in

```
Read section 3 of this addendum, docs/MEMBER-INTERFACE.md section 3.4b, and the existing Phase 5 check-in screen. Do not change the offline queue or the manual search path.

Make face the primary check-in method, with manual search alongside it permanently.

1. Server side matching endpoint: takes an embedding, scoped to the gathering's wing and branch, returns the best match above threshold with its score, or no match.
2. Officer check-in screen: camera runs alongside the existing search field, not instead of it. A confident match checks the member in. No match after a short attempt drops focus into the search field with no extra tap.
3. Liveness required at check-in as well as enrolment. Log the liveness score and the match score on every face check-in.
4. Face check-in is unavailable offline because matching is server side. Say so plainly on the screen. Manual search must continue to work offline exactly as it does now, and becomes the only method when the connection is down.
5. AttendanceRecord.method FACE, with the match score stored.
6. A member who has not enrolled simply never matches. The officer checks them in by name. There is no error state for this and no prompt anywhere suggesting they should enrol.

Manual check-in by name is permanent, not a temporary fallback. Do not remove it, hide it behind a menu, or make it feel like an error path.

Do not touch the offline queue implementation. If you believe you need to, stop and tell me why.

Show me the matching endpoint and the fallback behaviour before wiring the camera.
```

### B3: Threshold calibration

```
Build a calibration tool at /admin/devices/face-calibration, super admin only.

1. Run a set of test captures against enrolled embeddings and report false accept and false reject rates across a range of thresholds.
2. Let the threshold be configured rather than hardcoded, and record who changed it and when.
3. Report matching accuracy broken down by gathering, so poor performance in one location or one lighting condition is visible.

The threshold must be tuned on real captures taken at the mosque in real lighting, not on a number from documentation. Tell me plainly if the sample is too small to draw a conclusion from.
```

---

## 6. What not to do

- Do not create accounts in bulk at import time. There are no phone numbers to attach them to.
- Do not invent or generate placeholder phone numbers to get past a validation rule.
- Do not block a member's record from completing because face enrolment failed on their phone. Deferral completes the section.
- Do not nag a member who has deferred or declined.
- Do not store, upload or cache a face image for recognition purposes.
- Do not give any administrator a way to see an embedding.
- Do not let face recognition become the only working check-in method on any screen. Manual search by name is permanent.
- Do not enrol youth wing members under 18 without a separate committee decision on guardian consent.
