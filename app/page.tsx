import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardList, Receipt } from "lucide-react";
import { GlowLogo } from "@/components/member/brand";

// The public landing page: the logo's light in the dark (DESIGN.md 1),
// the name, the tagline, the two things a visitor can do here, and a
// short plain account of what a member finds inside.

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Your record",
    body: "Keep your details, household and next of kin up to date.",
  },
  {
    icon: Receipt,
    title: "Dues and receipts",
    body: "See what you owe and every payment the office has recorded.",
  },
  {
    icon: BookOpen,
    title: "Sermons and books",
    body: "Listen to recent sermons and read the weekly book.",
  },
] as const;

export default function Home() {
  return (
    <div className="member-area on-navy relative flex min-h-screen flex-col overflow-hidden bg-navy-950 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-amber-500/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy-900 to-transparent"
      />

      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="flex items-center gap-2.5">
          <GlowLogo size={28} />
          <span className="font-heading text-sm font-semibold tracking-tight">Anwaru-l-Huda League</span>
        </span>
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white"
        >
          Sign in
        </Link>
      </header>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pt-8 pb-12 text-center sm:px-6 sm:pt-16">
        <GlowLogo size={92} priority />

        <p lang="ar" dir="rtl" className="mt-6 font-arabic text-sm text-white/60">
          رابطة أنوار الهدى نيجيريا
        </p>
        <h1 className="mt-2 max-w-xl font-heading text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-4xl">
          Anwaru-l-Huda League of Nigeria
        </h1>
        <p className="mt-2 font-heading text-base text-amber-300 sm:text-lg">Guiding Lights</p>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
          The members&apos; portal for the men&apos;s, women&apos;s and youth wings. Sign in with the member number
          on your card.
        </p>

        <div className="mt-7 flex w-full max-w-xs flex-col gap-2.5 sm:max-w-sm sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-navy-950 shadow-[0_10px_28px_-12px_rgba(255,151,0,0.7)] transition-colors hover:bg-amber-soft sm:flex-1"
          >
            Sign in
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:flex-1"
          >
            Register as a member
          </Link>
        </div>

        <ul className="mt-12 grid w-full max-w-3xl gap-3 text-left sm:mt-16 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm sm:flex-col sm:gap-2.5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-white">{title}</span>
                <span className="text-sm leading-snug text-white/65">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </main>

      <footer className="relative px-4 pb-6 text-center text-xs text-white/45">
        Need help signing in? Ask at the league office.
      </footer>
    </div>
  );
}
