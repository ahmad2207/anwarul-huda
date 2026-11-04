import { formatNaira } from "@/lib/money";

// The one warm card in the member area (DESIGN.md 4.2): navy into amber,
// with a glow, carrying the number that matters most. Used on both Home
// and Payments so the balance always looks and reads the same.
export function BalanceCard({
  amountKobo,
  label,
  detail,
  action,
}: {
  amountKobo: number;
  label: string;
  detail: React.ReactNode;
  action?: React.ReactNode;
}) {
  const owes = amountKobo > 0;
  return (
    <div className="on-navy relative overflow-hidden rounded-[14px] bg-gradient-to-br from-navy-950 via-navy-900 to-[#6b4210] p-5 text-white shadow-warm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 size-52 rounded-full bg-amber-500/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 left-1/3 size-40 rounded-full bg-amber-300/15 blur-3xl"
      />
      <p className="relative text-sm font-medium text-white/80">{label}</p>
      <p
        className={`relative mt-1 font-mono text-3xl font-semibold tabular-nums ${owes ? "text-amber-300" : "text-white"}`}
      >
        {formatNaira(amountKobo)}
      </p>
      <div className="relative mt-1.5 text-sm text-white/85">{detail}</div>
      {action ? <div className="relative mt-4">{action}</div> : null}
    </div>
  );
}
