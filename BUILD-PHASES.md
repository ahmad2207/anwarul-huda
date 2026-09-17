# Build phases: prompts for Claude Code

Paste one phase at a time. Do not paste the next until the previous is reviewed, tested and committed.

Before you start, put `SPEC.md` in `docs/SPEC.md`, `CLAUDE.md` in the repository root, and `schema.prisma` in `prisma/schema.prisma`.

---

## Phase 0: Foundation

```
Read docs/SPEC.md and CLAUDE.md in full before writing any code, then read prisma/schema.prisma.

Set up the foundation for this project. Do not build any feature yet.

1. Scaffold a Next.js 15 App Router project with TypeScript in strict mode, Tailwind CSS and shadcn/ui.
2. Wire Prisma to PostgreSQL using the schema already in prisma/schema.prisma. Generate the initial migration. Do not change the schema without telling me first.
3. Set up Auth.js with credentials (email or phone, plus password). Sessions in the database. No social login.
4. Create lib/auth.ts with server side helpers: getCurrentUser, requireRole(roles), requireWingAccess(wingId). These must throw, not return null, so a missing check fails loudly.
5. Create lib/money.ts for kobo arithmetic and Naira formatting, and lib/phone.ts to normalise Nigerian numbers to E.164.
6. Create lib/audit.ts with a single writeAudit function that all mutations will call.
7. Write prisma/seed.ts that seeds: the three wings with their number letters, a default branch, the seven roles, one super admin user, the standard service areas for an Islamic organisation as listed in the spec, the five fund types, and two example contribution plans. Use obviously fictional names.
8. Add scripts to package.json: dev, build, typecheck, lint, test, db:migrate, db:seed, db:studio.
9. Add a minimal app shell: a sidebar layout for the admin area and a plain layout for the member area. No feature pages yet.

Stop when this is done. Show me the schema diff, the file tree and the seed output. Do not commit until I say so.
```

**Accept when:** `pnpm typecheck` passes, the seed runs clean, you can log in as the super admin and see an empty shell.

---

## Phase 1: Member register and approval

```
Read the members section of docs/SPEC.md and the Member, HouseholdMember and ServiceArea models before starting.

Build the membership register.

1. Admin list at /admin/members: paginated, searchable by name, phone and member number, filterable by wing, status and branch. Wing administrators must only see their own wing, enforced in the query on the server.
2. Member detail page showing every field from the spec, grouped into the same sections as the paper form, with an edit form.
3. Household sub-form: add, edit and remove household members, with an optional link to an existing member record.
4. Public registration form at /register, matching the paper form section by section. Creates a Member with status PENDING and source SELF_REGISTRATION. No account is activated yet.
5. Approval queue at /admin/approvals. For each pending record show possible duplicates, matched on exact phone and on fuzzy name, side by side. Approving issues the member number in the format AHL/<W>/<YYYY>/<NNNN>, sets status ACTIVE, creates the linked User account and writes the audit entry. Rejecting requires a reason.
6. Member number generation must be safe under concurrency. Use a database transaction with a sequence or a locked counter, not a count query.
7. Status changes are never deletions. Deactivating requires a reason and a date.
8. Validate everything with Zod on the server. Client validation is a convenience only.

Write unit tests for member number generation, the duplicate matcher and the wing scoping helper.

Show me the diff for the approval flow and the member number generator before anything else. Pause there.
```

**Accept when:** you can register, see the record in the queue, approve it, and the number is correct and unique. Try approving two at once and confirm no collision.

---

## Phase 2: Importing existing members

```
Read the import section of docs/SPEC.md and the ImportBatch model.

Build CSV import for members already collected on paper.

1. A downloadable CSV template whose columns match the paper Member Information Form exactly.
2. Upload at /admin/members/import. Parse with a streaming parser. Assume files up to five thousand rows.
3. Column mapping step: the system guesses the mapping from the headers, the user corrects it.
4. Validation and preview: show three groups, rows that will import cleanly, rows with warnings such as a missing email or an unparseable date, and rows that will fail with the reason. Nothing is written to the database at this stage.
5. Commit step: writes inside one transaction, sets source CSV_IMPORT and status ACTIVE, issues member numbers, links every row to the ImportBatch.
6. Rollback: an uncommitted batch can be discarded, and a committed batch can be rolled back in full as long as none of its members have payments or attendance against them. If any do, refuse and explain which.
7. Duplicate handling: a row whose phone number matches an existing member is flagged in the preview with a choice of skip, update or create anyway.

Show me the validation and preview logic before you build the commit step. Pause there.
```

**Accept when:** a deliberately messy CSV produces a preview that correctly separates clean, warning and failing rows, and the rollback works.

---

## Phase 3: Contributions and payments

```
Read the contributions section of docs/SPEC.md and the ContributionPlan, ContributionRecord, Payment and CashSession models. Re-read the domain rules in CLAUDE.md.

Build the finance module.

1. Contribution plan management: name, amount in kobo, frequency, wing scope, active flag.
2. Generation of ContributionRecord rows for a period, for all members in scope. This must be idempotent, so running it twice for the same period changes nothing.
3. Payment capture at /admin/payments/new, built for speed at a desk: search the member by name, phone or number, pick the plan or fund, enter the amount, pick cash, POS or transfer, enter a reference for POS and transfer. Record the collecting officer automatically.
4. Receipt numbers, sequential and unique, generated in the same transaction as the payment.
5. A printable receipt page and a plain text version suitable for pasting into WhatsApp.
6. Voiding: a payment is never edited or deleted. Voiding requires a reason, sets status VOIDED, reverses the amount against the contribution record, and writes the audit entry. The original row stays.
7. Cash sessions: open a session, all cash payments attach to it, close it by entering the counted cash. The system computes expected, counted and variance, and requires a note if the variance is not zero. A closed session cannot be reopened.
8. Reports: collections by period, by plan, by wing, by officer and by method. Arrears list per wing. All exportable to CSV.
9. A member sees their own payment history and outstanding balance at /account/payments.

All money is integer kobo. No floats anywhere in this module.

Show me the payment creation transaction and the void logic before building the reports. Pause there.
```

**Accept when:** a payment updates the contribution record, a void reverses it correctly, and a cash session with a deliberate shortfall reports the right variance.

---

## Phase 4: Charity funds and sharing dashboard

```
Read the charity section of docs/SPEC.md and the Fund, CharityCase and Disbursement models. The zakat rules and the separation of duty rule in CLAUDE.md are hard requirements.

Build the charity module.

1. Fund management for zakat, sadaqah, waqf, general and appeals. A fund balance is always derived from payments in and disbursements out, never stored as a mutable field.
2. Beneficiary case workflow: draft, verified, recommended, approved, disbursed, closed. Each transition records who and when.
3. A case drawing on a zakat fund must carry one of the eight zakat categories before it can reach APPROVED. Enforce in the service layer and at the database level with a check constraint. A zakat disbursement can never be assigned to an operational or running cost purpose.
4. Separation of duty: the user who recommends a case cannot approve it. Enforce in code and cover it with a test.
5. Disbursement recording: fund, approved case, amount, method, who paid out, evidence file upload.
6. Dashboard at /admin/charity showing, per fund and per selected period, opening balance, total received, total disbursed, closing balance, number of beneficiaries, and for zakat a breakdown across the eight categories. Include a period comparison.
7. A committee report export as CSV and as a printable page, suitable for presenting at a general meeting.

Write tests for the zakat category rule, the separation of duty rule and the balance calculation.

Show me the fund balance calculation and the zakat constraint first. Pause there.
```

**Accept when:** the system refuses a zakat disbursement without a category, refuses self-approval, and the dashboard balances tie out against the underlying rows.

---

## Phase 5: Attendance without hardware

```
Read the attendance section of docs/SPEC.md and the Gathering and AttendanceRecord models.

Build attendance, manual and QR only. Do not build anything biometric in this phase.

1. Gathering management: title, type, wing scope, branch, start and end. A gathering can be closed, after which no further check-in is accepted.
2. Check-in screen at /admin/attendance/<id>, designed for a phone held by a standing officer: large search field, results by name, photo and member number, one tap to check in, a running count, and an undo for the last few entries.
3. QR codes: generate a code per member containing the member number, rendered on the member profile and on a printable card sheet, eight cards to an A4 page. Scanning uses the device camera in the browser.
4. Duplicate check-ins for the same member and gathering are silently ignored rather than treated as errors.
5. Offline capability: the check-in screen must keep working with no connection. Queue check-ins locally and sync when the connection returns, showing a clear pending count. This is a hard requirement, not a nice to have.
6. Reports: attendance per gathering, per member over a period, attendance rate per wing, and members who have not attended in a given number of weeks.

Show me the offline queue design before you implement it. Pause there.
```

**Accept when:** you can run a full check-in with the network disabled and everything syncs correctly on reconnection.

---

## Phase 6: Sermons and weekly books

```
Read the content section of docs/SPEC.md and the ContentItem model.

Build content distribution.

1. Upload at /admin/content for sermons and weekly books: title, type, speaker or author, date delivered, summary, tags, cover image, file. Files go to object storage, never to the database.
2. Audio streams rather than downloading whole. Assume members are on mobile data.
3. Scheduled publishing: an item with a future publishAt is not visible until then.
4. Wing restriction: an item can be limited to one wing.
5. Member-facing library at /library, filterable by type, speaker, tag and date, with search. Paginated, light on payload.
6. Download counts per item.
7. Signed URLs with a short expiry for member-only content. No public bucket.

Keep the library page fast on a slow connection. Show me the storage and signed URL approach before building the upload UI. Pause there.
```

**Accept when:** a scheduled item stays hidden until its publish time, and a signed URL expires as expected.

---

## Phase 7: Reports, audit and hardening

```
Read CLAUDE.md again, particularly the domain rules.

Harden the system before it goes into real use.

1. Audit log viewer at /admin/audit, filterable by actor, entity, action and date, with a before and after diff view. Verify that every mutation to members, payments, disbursements and users actually writes an entry. List any that do not, and fix them.
2. Executive dashboard: membership totals and growth per wing, contribution collection against expectation, fund balances, attendance trend. One page the committee can look at.
3. Rate limiting on the public registration and login routes.
4. A security pass: confirm every server action and route handler checks role and wing scope. Produce a table of every mutation route and the check it performs. Flag any gaps rather than fixing them silently.
5. Backups: a documented restore procedure and a scheduled database export.
6. Error handling and empty states across the app. No raw errors reaching a user.
7. Playwright tests for the critical flows: registration to approval, payment to receipt, disbursement approval, check-in.

Give me the security table first. Pause there before making any change.
```

---

## Phase 8: Biometric bridge

Only start this once a device has been bought and tested.

```
Read section 5 of docs/SPEC.md carefully. The rule that no biometric template is ever stored in this database is absolute.

Build biometric attendance in two parts.

Part one, a separate bridge service in apps/bridge:
1. A small Node service that runs on a machine at the mosque, connects to the biometric terminal over the local network, and pulls new attendance logs on an interval.
2. It holds a device API key and posts logs to POST /api/attendance/ingest.
3. It queues to local disk when the internet is down and retries with backoff. It must never lose a log.
4. Configuration by environment file. Structured logging. A health endpoint.

Part two, in the main application:
5. POST /api/attendance/ingest, authenticated by the device key, accepting a batch of check-ins. Idempotent, so replaying a batch creates no duplicates.
6. Device management at /admin/devices: register a device, rotate its key, see when it was last seen.
7. Enrolment mapping at /admin/members/<id>/biometric: link a member to a device user ID. Require consentBiometric to be true before the mapping can be saved. There must be no path that stores a template, an image or a raw biometric sample.
8. A check-in arriving for an unmapped device user ID goes to an unmatched queue for an officer to resolve, rather than being dropped.
9. Every ingested check-in resolves to the correct open gathering by time window, or to the unmatched queue if none is open.

Confirm to me in writing, before you write any code, exactly what data the bridge sends and what the application stores. Pause there.
```
