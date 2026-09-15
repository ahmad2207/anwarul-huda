// DESIGN.md section 3: member numbers are mono, so they line up and are
// comparable at a glance. A member approved but not yet issued a number
// (numbers are assigned on approval, never reused) shows the same plain
// text every list already used by hand, now in one place.
export function MemberNumber({ value }: { value: string | null }) {
  return <span className="font-mono text-muted-foreground">{value ?? "Not yet issued"}</span>;
}
