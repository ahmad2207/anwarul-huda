import Link from "next/link";
import { GlowLogo } from "@/components/member/brand";

// The branded frame for the pages a person sees before they are inside
// the member area: sign in, choose a password, register (DESIGN.md 1 and
// 4.2). A deep navy hero with the logo's own amber light behind it, the
// Fraunces wordmark and the "Guiding Lights" tagline, then the form on a
// white card lifted off the paper ground.
export function PublicFrame({
  children,
  showArabic = false,
  wide = false,
}: {
  children: React.ReactNode;
  showArabic?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="member-area flex min-h-screen flex-col bg-paper text-ink">
      <div className="on-navy relative overflow-hidden bg-gradient-to-b from-navy-950 via-navy-950 to-navy-900 px-4 pt-10 pb-24 text-center text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-amber-500/10 blur-3xl"
        />
        <Link href="/" className="relative mx-auto flex w-fit flex-col items-center gap-3 rounded-[14px]">
          <GlowLogo size={88} priority />
          <span className="font-heading text-2xl font-semibold tracking-tight">Anwaru-l-Huda League of Nigeria</span>
        </Link>
        {showArabic ? (
          <p lang="ar" dir="rtl" className="relative mt-2 font-arabic text-lg text-white/85">
            رابطة أنوار الهدى نيجيريا
          </p>
        ) : null}
        <p className="relative mt-2 font-heading text-base text-amber-300">Guiding Lights</p>
      </div>

      <main className={`relative mx-auto -mt-16 w-full px-4 pb-12 ${wide ? "max-w-2xl" : "max-w-md"}`}>{children}</main>
    </div>
  );
}

export function PublicCard({ title, lead, children }: { title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-card p-6 shadow-warm sm:p-8">
      <h1 className="font-heading text-2xl font-semibold leading-tight text-navy-900">{title}</h1>
      {lead ? <div className="mt-2 text-base text-ink-2">{lead}</div> : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}
