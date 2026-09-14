# Anwar-ul-Huda League of Nigeria
## Membership and Administration System: Specification v1.0

Prepared for: the executive committee
Status: draft for approval
Date: September 2026

---

## 1. What this system is

A single web-based system that holds the complete record of every member of Anwar-ul-Huda League of Nigeria, tracks their contributions, records attendance at gatherings, manages the charity funds, and distributes sermons and weekly publications.

It replaces paper registers, exercise-book ledgers and scattered WhatsApp records with one source of truth that the executive can query at any time.

### 1.1 Who uses it

| User | What they do |
|---|---|
| Member | Registers, views own profile, sees own contribution history and receipts, downloads sermons and weekly books |
| Wing administrator | Approves new members in their wing, manages member records for their wing |
| Finance officer | Records cash and POS payments, issues receipts, reconciles the till, runs contribution reports |
| Charity officer | Registers beneficiaries, records disbursements, reports on fund balances |
| Attendance officer | Runs check-in at gatherings, enrols members on the biometric device |
| Content editor | Uploads sermons and weekly books |
| Super administrator | Everything, plus user management, configuration and the audit log |

### 1.2 The three wings

Men's wing, women's wing and youth wing are first-class entities, not tags. Every member belongs to exactly one. Wing administrators see only their own wing by default. Finance and charity reporting rolls up across all three, and also breaks down per wing. Youth wing members who pass the age threshold are flagged for transfer rather than moved automatically, because that decision belongs to the committee.

---

## 2. Modules

### 2.1 Membership register

The core. Fields mirror the paper Member Information Form exactly, so that forms already collected can be typed in or imported without translation.

Captured per member:

- Identity: title, surname, first name, other names, date of birth, gender, marital status, occupation, nationality, state of origin, languages spoken, photograph
- Contact: mobile, alternative number, email, address, city, state, nearest landmark, preferred contact channel
- Household: spouse or spouses, children and others, each with name, age and relationship. Where a household member is also a member of the league, the two records are linked
- Membership: member number, wing, masjid or branch, year joined, status, role or office held, halaqah or usrah group
- Service: areas of service, Islamic education or qualifications, other skills, general availability
- Next of kin: name, relationship, phone numbers
- Consent: record keeping, directory listing, communications

Member numbers are generated on approval in the format `AHL/M/2026/0001`, where the middle letter is the wing (M, W, Y).

Statuses: pending, active, occasional, relocated, honorary, inactive, deceased. Records are never deleted. A member who leaves is marked inactive with a reason and a date.

### 2.2 Self-registration with approval

A member registers through a public form, which creates a record with status `pending`. Nothing else happens until a wing administrator reviews it. On approval the member number is issued, the account is activated and a welcome message goes out. On rejection the applicant is told, with a reason.

The approval queue shows likely duplicates side by side, matched on phone number and on name similarity, because in practice the same person will register twice.

### 2.3 Importing existing members

A CSV import that takes the details already collected on paper and in existing spreadsheets.

The import is deliberately careful:

1. Upload the file and map its columns to system fields
2. The system validates every row and shows a preview: rows that will import cleanly, rows with warnings, rows that will fail and why
3. Nothing is written until the import is confirmed
4. Every import is recorded as a batch, and a batch can be rolled back in full if it was wrong

Imported members arrive with status `active` and source `import`, and are exempt from the approval queue. A downloadable CSV template ships with the system.

### 2.4 Contributions and payments

Contributions are defined as plans: monthly dues, building fund, Eid levy, and so on. Each plan has an amount, a frequency and a scope, which may be all members or one wing.

Payments are recorded by a finance officer at the mosque. There is no online payment gateway in version 1, because collection happens in person with cash and POS.

Each payment records: member, contribution plan or fund, amount, method (cash, POS, bank transfer), POS or transfer reference, who collected it, when, and a generated receipt number. A receipt can be printed or sent to the member by WhatsApp or SMS.

Two rules that matter:

- A payment is never edited or deleted. A mistake is corrected by voiding the original with a reason and entering a new one. The void and the reason are both permanent.
- Cash collection runs in sessions. An officer opens a session, records payments, then closes it by counting the cash and entering the figure. The system shows expected against counted, and the difference. This is the control that makes cash handling defensible to the committee.

Members see their own contribution history and outstanding balance. Administrators see arrears lists per wing.

### 2.5 Charity funds and sharing dashboard

Funds are held and reported separately, because they are not interchangeable:

- Zakat
- Sadaqah
- Waqf
- General or operational
- Special appeals, created as needed

Zakat is tracked against the eight categories of recipient, so that a disbursement must be assigned to a category before it can be approved. Zakat cannot be applied to running costs, and the system enforces that at the point of entry rather than leaving it to memory.

Beneficiary cases carry: beneficiary details, the need, supporting notes, who verified it, the recommended amount and the approval. A disbursement then draws from a specified fund against an approved case, records who authorised and who paid out, and attaches evidence.

The dashboard shows, per fund and per period: opening balance, received, disbursed, closing balance, number of beneficiaries, and a breakdown by category. This is the view the committee needs at general meetings and the one that answers questions from donors.

### 2.6 Attendance

Attendance is recorded at gatherings: Jumu'ah, ta'leem, wing meetings, general meetings and programmes. An administrator creates the gathering, check-in runs against it, and the register closes afterwards.

Three capture methods, in the order they should be built:

1. **Manual and search.** An officer searches by name or member number and checks the member in. Always available, and the fallback when anything else fails.
2. **QR code.** Every member has a QR code on their profile and on a printed card. An officer scans it with any phone camera. Cheap, works immediately, no hardware purchase.
3. **Biometric device.** A fingerprint or face terminal at the entrance.

Section 5 explains why biometrics is built last and how it connects.

### 2.7 Sermons and weekly publications

Content editors upload sermons (audio, video link, or notes) and the weekly book, each with a title, speaker or author, date, summary and tags. Members browse and download. Items can be scheduled to publish on a date, and can be restricted to one wing where that is appropriate.

Files are stored in object storage, not in the database. Large audio files are streamed rather than downloaded whole, because members will open these on mobile data.

---

## 3. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | One codebase for the UI and the API, and it matches existing skills |
| Styling | Tailwind CSS with shadcn/ui | Fast, consistent, accessible components out of the box |
| Database | PostgreSQL on Supabase | Managed, affordable, and the storage and auth come with it |
| ORM | Prisma | Explicit schema, good migrations, and readable to a reviewer |
| Auth | Auth.js with email and password, plus phone OTP later | Members will not all have reliable email |
| File storage | Supabase Storage | Same provider, signed URLs for member-only content |
| Background jobs | Simple cron routes to start | Do not add a queue until something actually needs one |
| Hosting | Vercel for the app, Supabase for data | Low operating cost, no server to maintain |

Two practical notes for the Nigerian context. First, the app should be a progressive web app with offline capture on the attendance and payment screens, queuing locally and syncing when the connection returns, because mosque network is not dependable and a finance officer cannot be blocked mid-collection. Second, keep the member-facing pages light. Assume a mid-range Android phone on a slow connection.

---

## 4. Roles and permissions

| Capability | Member | Wing admin | Finance | Charity | Attendance | Content | Super |
|---|---|---|---|---|---|---|---|
| View own record | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View wing members | No | Own wing | All, read only | No | Own wing | No | All |
| Approve registrations | No | Own wing | No | No | No | No | All |
| Edit member records | Own, limited | Own wing | No | No | No | No | All |
| Record payments | No | No | Yes | No | No | No | Yes |
| Void payments | No | No | With reason | No | No | No | Yes |
| Close cash session | No | No | Yes | No | No | No | Yes |
| Approve disbursement | No | No | No | Recommend | No | No | Yes |
| Record disbursement | No | No | No | Yes | No | No | Yes |
| Run check-in | No | Own wing | No | No | Yes | No | Yes |
| Upload content | No | No | No | No | No | Yes | Yes |
| Manage users and roles | No | No | No | No | No | No | Yes |
| View audit log | No | No | No | No | No | No | Yes |

Separation of duty is deliberate in the charity module: the officer who recommends a disbursement should not be the one who approves it. Configure this so that a single person cannot do both on the same case.

---

## 5. Biometric attendance: how it actually works

This is the part most likely to go wrong, so it is worth being precise.

### 5.1 The constraint

A web browser cannot talk to a USB fingerprint reader or a face terminal. There is no way around this. Any system that claims otherwise is either using a browser extension, a locally installed helper, or it is not doing what it says.

### 5.2 The recommended approach

Use a standalone network biometric terminal, of the type already common in Nigerian offices and mosques, for example the ZKTeco range. The terminal does the enrolment and the matching itself and holds the templates on the device. Your system never receives or stores a fingerprint or a face template.

A small bridge service, running on a cheap machine at the mosque or on a Raspberry Pi, connects to the terminal over the local network, pulls new check-in logs on a short interval, and posts them to the system API. The bridge holds a device key, queues locally if the internet is down, and retries.

Your database stores only a mapping: device user ID 0147 is member AHL/M/2026/0113. That is all.

### 5.3 Why this way

- Matching accuracy is the device manufacturer's problem, not yours. Browser-based face recognition in mosque lighting, with members in caps and veils, will not work reliably, and the failures will be blamed on the system.
- You avoid storing biometric data entirely. Under the Nigeria Data Protection Act, biometric data is sensitive personal data and attracts obligations you do not want to carry if you can avoid them. Holding only an ID mapping is materially safer.
- A terminal at the entrance keeps working when the internet does not. The bridge catches up later.
- Hardware is replaceable. If the device changes, only the bridge changes.

### 5.4 Consent

Members must be asked, in writing, before they are enrolled on a biometric device, and must be able to decline and use the QR card instead. Add a consent field to the member record and require it before enrolment. The women's wing in particular may have views on face capture that need to be settled by the committee, not by the system.

---

## 6. Build order

Each phase produces something usable. Nothing in a later phase is required for an earlier one to work.

| Phase | Delivers | Notes |
|---|---|---|
| 0 | Repository, schema, auth, seed data, deployment pipeline | Foundation |
| 1 | Member register, wings, branches, approval queue | The system is useful from here |
| 2 | CSV import with preview and rollback | Get the paper backlog in |
| 3 | Contribution plans, payments, receipts, cash sessions | Finance can stop using the exercise book |
| 4 | Charity funds, beneficiary cases, disbursements, dashboard | |
| 5 | Attendance: gatherings, manual check-in, QR codes | No hardware needed |
| 6 | Sermons and weekly books | |
| 7 | Reports, audit log, offline capture, hardening | |
| 8 | Biometric bridge and device enrolment | Only after hardware is bought and tested |

A realistic estimate for one developer working steadily is a working phase 1 to 3 in the first stretch, with phases 4 to 6 following, and phases 7 and 8 treated as a separate effort once the system is in real use. Do not promise the committee biometrics in the first release.

---

## 7. Decisions needed before building

These change the shape of the system, so settle them early.

1. **Is there more than one masjid or branch?** If the league operates in several locations, branch has to be in the data model from the start. It is painful to add later.
2. **Which biometric hardware, if any?** Buy one device and test it before phase 8 is planned. The model determines the bridge.
3. **What are the actual contribution plans?** Names, amounts, frequencies, and which wing each applies to.
4. **What is the youth wing age range, and what happens at the upper limit?**
5. **Who approves charity disbursements, and above what amount does it need a second approver?**
6. **Is a member photograph required, optional, or not collected for the women's wing?**
7. **Hosting budget.** The recommended stack runs at a low monthly cost, but it is not free once storage grows with sermon audio.

---

## 8. Things deliberately not in version 1

Stated so that nobody assumes they are coming:

- Online payment by card or bank transfer through a gateway
- SMS or WhatsApp automation beyond manual receipt sending
- A native mobile app
- Multi-language interface
- Accounting integration or export to formal accounting software
- Member-to-member messaging

Each of these is reasonable later. None of them should delay the first release.
