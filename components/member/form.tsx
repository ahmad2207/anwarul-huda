import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { cn } from "cn";

// Form pieces for the member area and the public pages around it
// (DESIGN.md 5 and 8): large 14px radius inputs, a real <label htmlFor>
// on every field, hints tied to the field, and errors announced with
// role="alert". Plain elements rather than the admin primitives, so the
// sizes here never depend on admin defaults.

export const inputClass =
  "h-11 w-full min-w-0 rounded-xl border border-border bg-white px-3.5 text-base text-ink shadow-[inset_0_1px_2px_rgb(74_52_18/6%)] placeholder:text-ink-2/70 disabled:cursor-not-allowed disabled:opacity-60";

export const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-navy-950 px-5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(4,20,40,0.5)] transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 text-sm font-semibold text-navy-900 transition-colors hover:bg-paper-dim/60 disabled:cursor-not-allowed disabled:opacity-60";

export function Field({
  label,
  id,
  hint,
  className,
  ...inputProps
}: {
  label: string;
  id: string;
  hint?: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"input">, "id" | "className">) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {inputProps.required ? <span className="text-ink-2"> (required)</span> : null}
      </label>
      <input id={id} name={inputProps.name ?? id} aria-describedby={hintId} className={inputClass} {...inputProps} />
      {hint ? (
        <p id={hintId} className="text-sm text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  id,
  options,
  placeholder,
  required = false,
  defaultValue,
  className,
}: {
  label: string;
  id: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-ink-2"> (required)</span> : null}
      </label>
      <select id={id} name={id} required={required} defaultValue={defaultValue ?? ""} className={inputClass}>
        {placeholder !== undefined ? (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckboxRow({
  name,
  value,
  defaultChecked,
  required,
  children,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] border border-border bg-white p-3 text-base">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        className="mt-0.5 size-5 shrink-0 accent-navy-900"
      />
      <span>{children}</span>
    </label>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-[14px] bg-alert-soft p-3 text-base text-alert">
      <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function FieldGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-[14px] bg-card p-5 shadow-warm">
      <legend className="float-left mb-1 w-full font-heading text-lg font-semibold text-navy-900">{title}</legend>
      {description ? <p className="-mt-2 text-base text-ink-2">{description}</p> : null}
      {children}
    </fieldset>
  );
}

// "Save and continue" plus a way back to the contents list, used by
// every record section.
export function SectionActions({ isPending, submitLabel = "Save and continue" }: { isPending: boolean; submitLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={isPending} className={primaryButtonClass}>
        {isPending ? "Saving..." : submitLabel}
      </button>
      {isPending ? (
        <span aria-disabled="true" className={cn(secondaryButtonClass, "opacity-60")}>
          Back to your record
        </span>
      ) : (
        <Link href="/account/record" className={secondaryButtonClass}>
          Back to your record
        </Link>
      )}
    </div>
  );
}
