# CLAUDE.md

Project instructions for Claude Code. Read this before doing anything in this repository.

## Project

Anwar-ul-Huda League of Nigeria membership and administration system. A Next.js application covering the member register, contributions and payments, charity fund management, attendance, and content distribution for an Islamic organisation with three wings: men's, women's and youth.

Full specification is in `docs/SPEC.md`. Read it before implementing any feature.

## How to work in this repository

1. **Read before writing.** At the start of a task, read the existing files you are about to touch, plus the Prisma schema and any related route handlers. Do not assume structure from the file names.
2. **One phase at a time.** Work only on the phase named in the prompt. If you notice something broken in an earlier phase, say so and wait. Do not fix it silently.
3. **Show the diff before committing.** Present the changes, wait for review, then commit. Never commit without an explicit go-ahead.
4. **Do not refactor surrounding code without asking.** If existing code is in your way, describe the problem and propose the change. Then stop.
5. **Ask when the spec is ambiguous.** Do not invent a business rule. Charity, finance and membership rules have real consequences.
6. **Run the checks.** `pnpm typecheck`, `pnpm lint` and `pnpm test` must pass before you present work as complete.

## Stack

- Next.js 15, App Router, TypeScript strict mode
- Tailwind CSS with shadcn/ui
- PostgreSQL via Supabase, accessed through Prisma
- Auth.js for authentication
- Supabase Storage for sermon audio, publications and member photographs
- Zod for all input validation
- Vitest for unit tests, Playwright for the critical flows

## Conventions

- Server Components by default. Add `"use client"` only where interactivity requires it.
- All mutations go through Server Actions or route handlers, never directly from a client component to the database.
- Every input is validated with a Zod schema on the server. Client validation is a convenience, never the boundary.
- Money is stored as integer kobo, never as a float. Format only at the point of display.
- Dates are stored in UTC. Display in Africa/Lagos.
- Files: `kebab-case.ts`. React components: `PascalCase.tsx`. Database tables and columns: `snake_case` via Prisma `@map`.
- No `any`. If a type is genuinely unknown, use `unknown` and narrow it.
- Every list view is paginated and searchable. Assume ten thousand members.

## Domain rules that must not be broken

These are not preferences. Breaking them creates real problems for the organisation.

1. **Member records are never hard deleted.** Change status to `INACTIVE` or `DECEASED` with a reason and a date.
2. **Payments are never edited or deleted.** Correct a mistake by voiding the original with a reason and creating a new payment. Both records persist.
3. **Zakat funds are ring-fenced.** A zakat disbursement must be assigned to one of the eight recipient categories before it can be approved. Zakat can never be applied to operational or running costs. Enforce this in the data layer, not only in the UI.
4. **Separation of duty on charity.** The user who recommends a disbursement cannot be the user who approves it. Enforce in code.
5. **Wing scoping.** A wing administrator sees and edits only their own wing. Enforce this on the server in every query, not by hiding buttons in the UI.
6. **Biometric templates are never stored in this database.** The biometric terminal holds the templates. This system stores only a mapping from device user ID to member ID. If a task appears to require storing a fingerprint or face template, stop and raise it.
7. **Every write to members, payments, disbursements and users is written to the audit log** with actor, action, entity, before and after.

## Currency and formatting

- Nigerian Naira. Store kobo as `Int`. Display as `₦1,250.00`.
- Phone numbers stored in E.164 (`+2348012345678`). Accept local format on input and normalise.
- Member numbers: `AHL/<W>/<YYYY>/<NNNN>` where `<W>` is `M`, `W` or `Y` for the wing. Generated on approval, never reused.

## Writing style in the product

- No em dashes anywhere in UI copy, documentation, commit messages or code comments.
- Plain English in user-facing text. The audience is not technical.
- Islamic terms use the organisation's spelling: Jumu'ah, ta'leem, halaqah, sadaqah, zakat, janazah, da'wah, nikah.

## Commands

```
pnpm dev            # development server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # vitest
pnpm test:e2e       # playwright
pnpm db:migrate     # prisma migrate dev
pnpm db:studio      # prisma studio
pnpm db:seed        # seed roles, wings, funds, contribution plans
```

## What not to do

- Do not add a dependency without saying why and waiting for agreement.
- Do not scaffold a feature from a later phase because it seemed convenient.
- Do not write seed data that looks like real members. Use obviously fictional names.
- Do not generate migration files by hand. Use Prisma.
- Do not add analytics, tracking or third party scripts.
