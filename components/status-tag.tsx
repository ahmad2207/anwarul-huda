import { AlertTriangle, Check, XCircle } from "lucide-react";
import type { ComponentType } from "react";

// DESIGN.md section 2: colour carries state, never decoration, and is
// never the only signal. This is the one place any status gets its
// colour and its icon; every other file just decides which of the four
// tones its own status value means and hands the word to this.

export type StatusTone = "confirmed" | "attention" | "alert" | "neutral";

// confirmed, attention and alert render as a small tinted pill (word and
// icon together, never colour alone). neutral stays plain text: it is a
// fact about the record (draft, closed, inactive), not a state, and
// giving it a pill would make it read as one.
const TONE_CLASSES: Record<StatusTone, string> = {
  confirmed: "bg-sabon-soft text-sabon",
  attention: "bg-amber-soft text-amber-800",
  alert: "bg-alert-soft text-alert",
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
  const isPill = tone !== "neutral";
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold ${TONE_CLASSES[tone]} ${
        isPill ? "rounded-full px-2.5 py-0.5 text-xs" : ""
      }`}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
