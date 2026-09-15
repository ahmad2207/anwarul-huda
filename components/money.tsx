import { formatNaira } from "@/lib/money";

// DESIGN.md section 3 and 4.1: amounts are mono, tabular and right
// aligned, everywhere they appear. This is the one place that alignment
// is decided, so a table cell that drops in <Money> never has to repeat
// the classes by hand and never drifts from the others.
export function Money({ kobo, className = "" }: { kobo: number; className?: string }) {
  return <span className={`block text-right font-mono tabular-nums ${className}`}>{formatNaira(kobo)}</span>;
}
