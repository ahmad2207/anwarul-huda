import { cn } from "cn";

// The member area's building blocks (DESIGN.md 4.2 and 5): a 14px
// radius card lifted off the paper ground by a soft warm shadow, and
// Fraunces for anything that announces itself.

export const memberCardClass = "rounded-[14px] bg-card shadow-warm";

export function MemberCard({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "li";
}) {
  return <Tag className={cn(memberCardClass, "p-5", className)}>{children}</Tag>;
}

export function PageTitle({ children, lead }: { children: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-heading text-2xl font-semibold leading-tight text-navy-900">{children}</h1>
      {lead ? <div className="text-base text-ink-2">{lead}</div> : null}
    </div>
  );
}

export function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-heading text-lg font-semibold text-navy-900">
      {children}
    </h2>
  );
}

// A card that is itself a link onward. 44px minimum height (DESIGN.md 8).
export const memberLinkCardClass = cn(
  memberCardClass,
  "flex min-h-14 flex-col justify-center gap-0.5 p-4 transition-colors hover:bg-paper-dim/50",
);
