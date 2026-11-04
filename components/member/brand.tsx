// The logo with its faint amber glow, and the Fraunces wordmark
// (DESIGN.md 1 and 5). Only used where DESIGN.md 5 allows the logo: the
// member portal header, the login screen and the public landing page.
export function GlowLogo({ size = 40, priority = false }: { size?: number; priority?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <span aria-hidden="true" className="logo-glow pointer-events-none absolute -inset-[60%] rounded-full" />
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static asset, not one next/image needs to optimise */}
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        className="relative"
        fetchPriority={priority ? "high" : undefined}
      />
    </span>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-heading font-semibold tracking-tight ${className}`}>Anwaru-l-Huda League</span>;
}
