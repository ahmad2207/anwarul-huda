import { Label } from "@/components/ui/label";

// A placeholder is not a label (DESIGN.md section 8). This always
// renders a real <Label>, wired to the field by htmlFor/id, so a form
// field can never be built with only a placeholder standing in for one.
export function FormField({
  label,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
