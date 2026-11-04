import Link from "next/link";
import { GlowLogo } from "@/components/member/brand";

export default function NotFound() {
  return (
    <main className="member-area flex min-h-screen flex-col items-center justify-center gap-5 bg-paper px-4 py-12 text-center text-ink">
      <div className="on-navy rounded-full bg-navy-950 p-5">
        <GlowLogo size={56} />
      </div>
      <h1 className="font-heading text-2xl font-semibold text-navy-900">We could not find that page</h1>
      <p className="max-w-md text-base text-ink-2">
        The link may be old, or the page may have been moved. It is also possible your account cannot see
        it.
      </p>
      <Link
        href="/"
        className="inline-flex h-12 items-center justify-center rounded-[14px] bg-navy-950 px-6 text-base font-semibold text-white hover:bg-navy-800"
      >
        Go to the start
      </Link>
    </main>
  );
}
