import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { MemberNumber } from "@/components/member-number";
import { DataTable } from "@/components/data-table";
import { StatusTag } from "@/components/status-tag";

// A living reference, not a design document: every token, the type
// scale and every shared primitive, rendered with the real components
// rather than described. Restricted to SUPER_ADMIN because it is a
// building tool, not something a wing admin or officer needs open
// during their working day.

const COLOR_SWATCHES: Array<{ name: string; className: string; use: string }> = [
  { name: "navy-950", className: "bg-navy-950", use: "Deepest ground. Check-in field, sidebar gradient base" },
  { name: "navy-900", className: "bg-navy-900", use: "Primary. Sidebar, primary buttons, headings on white" },
  { name: "navy-800", className: "bg-navy-800", use: "Mid step for gradients and hover states on navy" },
  { name: "navy-700", className: "bg-navy-700", use: "Links and active states on white" },
  { name: "amber-500", className: "bg-amber-500", use: "The light. Glows and small solid marks on navy" },
  { name: "amber-300", className: "bg-amber-300", use: "Soft glow highlight, lighter edge of an amber gradient" },
  { name: "amber-800", className: "bg-amber-800", use: "Attention on white: pending, arrears, till variance, unsynced" },
  { name: "amber-soft", className: "bg-amber-soft border", use: "Attention pill background on white" },
  { name: "paper", className: "bg-paper border", use: "Application background. Warm, not blue-grey" },
  { name: "paper-dim", className: "bg-paper-dim border", use: "Card wells and recessed surfaces on paper" },
  { name: "sabon", className: "bg-sabon", use: "Confirmed only: paid, approved, checked in, synced" },
  { name: "sabon-soft", className: "bg-sabon-soft border", use: "Confirmed pill background on white" },
  { name: "alert", className: "bg-alert", use: "Voided, rejected, failed, shortfall" },
  { name: "alert-soft", className: "bg-alert-soft border", use: "Alert pill background on white" },
  { name: "ink", className: "bg-ink", use: "Body text" },
  { name: "ink-2", className: "bg-ink-2", use: "Secondary text" },
];

const TYPE_SCALE: Array<{ label: string; className: string }> = [
  { label: "text-2xl", className: "text-2xl" },
  { label: "text-xl", className: "text-xl" },
  { label: "text-lg", className: "text-lg" },
  { label: "text-base", className: "text-base" },
  { label: "text-sm", className: "text-sm" },
  { label: "text-xs", className: "text-xs" },
];

interface ExampleMember {
  id: string;
  name: string;
  memberNumber: string | null;
  wing: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "INACTIVE";
}

const EXAMPLE_MEMBERS: ExampleMember[] = [
  { id: "1", name: "Bello Fatima", memberNumber: "AHL/W/2026/0042", wing: "Women's wing", status: "ACTIVE" },
  { id: "2", name: "Danladi Yusuf", memberNumber: null, wing: "Youth wing", status: "PENDING" },
  { id: "3", name: "Nasir Garba", memberNumber: "AHL/M/2024/0011", wing: "Men's wing", status: "REJECTED" },
];

function exampleStatusTone(status: ExampleMember["status"]) {
  if (status === "PENDING") return "attention" as const;
  if (status === "ACTIVE") return "confirmed" as const;
  if (status === "REJECTED") return "alert" as const;
  return "neutral" as const;
}

export default async function StyleguidePage() {
  await requireRole(["SUPER_ADMIN"]);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Styleguide"
        description="Tokens, type and the shared primitives every admin, member and check-in screen is built from. See DESIGN.md for the full direction."
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Colour</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Colour carries state, never decoration, and is never the only signal. Amber-500 never appears as text on
          white; amber-800 does that work instead.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {COLOR_SWATCHES.map((swatch) => (
            <div key={swatch.name} className="flex flex-col gap-2 rounded-md border p-3">
              <div className={`h-12 rounded-md ${swatch.className}`} />
              <p className="font-mono text-xs">{swatch.name}</p>
              <p className="text-xs text-muted-foreground">{swatch.use}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Type</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Fraunces for anything that announces itself: page titles, card titles, the wordmark, the check-in
          count. Plus Jakarta Sans for the interface: body copy, form fields, table cells. IBM Plex Mono for
          money, member numbers, receipt numbers and references only, never for labels or headings. Scale
          ratio 1.25.
        </p>
        <div className="flex flex-col gap-2 rounded-md border p-4">
          <p className="font-heading text-2xl font-bold">
            <span className="mr-3 font-mono text-xs font-normal text-muted-foreground">font-heading</span>
            Anwar-ul-Huda League
          </p>
          {TYPE_SCALE.map((step) => (
            <p key={step.label} className={step.className}>
              <span className="mr-3 font-mono text-xs text-muted-foreground">{step.label}</span>
              The quick officer records fifty payments in a sitting
            </p>
          ))}
          <p className="font-mono text-base">
            <span className="mr-3 font-mono text-xs text-muted-foreground">font-mono</span>
            AHL/M/2026/0113 &middot; N1,250.00
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">StatusTag</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          The one place a status gets a colour and an icon. Every list decides which of the four tones its own
          status value means, and hands the word to this.
        </p>
        <div className="flex flex-wrap gap-4 rounded-md border p-4 text-sm">
          <StatusTag tone="confirmed">Confirmed</StatusTag>
          <StatusTag tone="attention">Pending</StatusTag>
          <StatusTag tone="alert">Voided</StatusTag>
          <StatusTag tone="neutral">Inactive</StatusTag>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Money and MemberNumber</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Both render in mono. Money formats kobo to Naira and right aligns, so a column of amounts lines up on the
          decimal.
        </p>
        <div className="flex max-w-xs flex-col gap-2 rounded-md border p-4 text-sm">
          <Money kobo={125000} />
          <Money kobo={5000000} />
          <MemberNumber value="AHL/Y/2026/0009" />
          <MemberNumber value={null} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">PageHeader</h2>
        <div className="rounded-md border p-4">
          <PageHeader
            title="Example page"
            description="One line of description, and an optional action on the right."
            actions={<Button size="sm">Primary action</Button>}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">FormField</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Always renders a real label. A placeholder is not a label.
        </p>
        <div className="max-w-xs rounded-md border p-4">
          <FormField label="Name, phone or member number" htmlFor="styleguide-search">
            <Input id="styleguide-search" placeholder="Search..." />
          </FormField>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">EmptyState</h2>
        <div className="rounded-md border">
          <EmptyState
            message="No payments recorded today."
            action={
              <Button size="sm" variant="outline">
                Open a cash session
              </Button>
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">DataTable</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Rows, not cards, with a sticky header and hairline separators. Every admin list and report table is built
          from this. Names below are examples, not real members.
        </p>
        <DataTable
          columns={[
            {
              key: "name",
              header: "Name",
              cell: (member: ExampleMember) => <span className="font-medium">{member.name}</span>,
            },
            {
              key: "memberNumber",
              header: "Member number",
              cell: (member: ExampleMember) => <MemberNumber value={member.memberNumber} />,
            },
            { key: "wing", header: "Wing", cell: (member: ExampleMember) => member.wing },
            {
              key: "status",
              header: "Status",
              cell: (member: ExampleMember) => (
                <StatusTag tone={exampleStatusTone(member.status)}>
                  {member.status.charAt(0) + member.status.slice(1).toLowerCase()}
                </StatusTag>
              ),
            },
          ]}
          rows={EXAMPLE_MEMBERS}
          rowKey={(member) => member.id}
          emptyMessage="No members match this search."
        />
      </section>
    </div>
  );
}
