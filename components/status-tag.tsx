import { AlertTriangle, Check, XCircle } from "lucide-react";
import type { ComponentType } from "react";

// DESIGN.md section 2: colour carries state, never decoration, and is
// never the only signal. This is the one place any status gets its
// colour and its icon; every other file just decides which of the four
// tones its own status value means and hands the word to this.

export type StatusTone = "confirmed" | "attention" | "alert" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  confirmed: "text-sabon",
  attention: "text-amber-800",
  alert: "text-alert",
  // Most of a record's possible states are not one of the three above,
  // only a fact (occasional, draft, closed). Those get no colour at
  // all, inheriting whatever the surrounding text already is, rather
  // than reaching for a colour that would not mean anything.
  neutral: "text-current",
};

const TONE_ICONS: Record<StatusTone, ComponentType<{ className?: string }> | null> = {
  confirmed: Check,
  attention: AlertTriangle,
  alert: XCircle,
  neutral: null,
};

export function StatusTag({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const Icon = TONE_ICONS[tone];
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${TONE_CLASSES[tone]}`}>
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
