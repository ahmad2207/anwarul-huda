import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlowLogo } from "@/components/member/brand";

// The public landing page: the logo's light in the dark (DESIGN.md 1),
// the name, the tagline, and the two things a visitor can do here.
export default function Home() {
  return (
    <main className="member-area on-navy relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-navy-950 via-navy-950 to-navy-900 px-4 py-16 text-center text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-3xl"
      />
      <div className="relative flex max-w-xl flex-col items-center gap-5">
        <GlowLogo size={128} priority />
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            Anwaru-l-Huda League of Nigeria
          </h1>
          <p className="font-heading text-xl text-amber-300">Guiding Lights</p>
        </div>
        <p className="max-w-md text-base text-white/80">
          Your membership record, your dues and receipts, and the sermons and weekly book the league shares,
          in one place.
        </p>
        <div className="mt-2 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-white px-6 text-base font-semibold text-navy-950 shadow-[0_8px_24px_-10px_rgba(255,151,0,0.55)] hover:bg-amber-soft"
          >
            Sign in
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href="/register"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-[14px] border border-white/40 px-6 text-base font-semibold text-white hover:bg-white/10"
          >
            Register as a member
          </Link>
        </div>
      </div>
    </main>
  );
}
