import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import type { CurrentUser } from "@/lib/auth";

// Structural navigation. Items with no href point at a route a later phase
// builds and render disabled for now.
const NAV_SECTIONS: Array<{ label: string; items: Array<{ label: string; href?: string }> }> = [
  {
    label: "Membership",
    items: [
      { label: "Members", href: "/admin/members" },
      { label: "Approval queue", href: "/admin/approvals" },
      { label: "Record progress", href: "/admin/members/incomplete" },
      { label: "Record reviews", href: "/admin/members/review" },
      { label: "Duplicate flags", href: "/admin/members/duplicates" },
      { label: "Bulk issue logins", href: "/admin/members/bulk-issue-login" },
      { label: "Import", href: "/admin/members/import" },
      { label: "Member cards", href: "/admin/members/cards" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Payments", href: "/admin/payments" },
      { label: "Plans", href: "/admin/contributions/plans" },
      { label: "Generate records", href: "/admin/contributions/generate" },
      { label: "Cash sessions", href: "/admin/cash-sessions" },
      { label: "Reports", href: "/admin/reports" },
    ],
  },
  {
    label: "Charity",
    items: [
      { label: "Dashboard", href: "/admin/charity" },
      { label: "Funds", href: "/admin/charity/funds" },
      { label: "Beneficiary cases", href: "/admin/charity/cases" },
      { label: "Disbursements", href: "/admin/charity/disbursements/new" },
    ],
  },
  {
    label: "Attendance",
    items: [
      { label: "Gatherings", href: "/admin/attendance" },
      { label: "Reports", href: "/admin/attendance/reports" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Upload", href: "/admin/content" },
      { label: "Announcements", href: "/admin/content/announcements" },
    ],
  },
  {
    label: "System",
    items: [{ label: "Users", href: "/admin/users" }, { label: "Audit log", href: "/admin/audit" }],
  },
];

export function AdminSidebar({ user }: { user: CurrentUser }) {
  // Styleguide is a building tool, not something every officer needs open
  // during their working day, so it only shows for the role that would
  // actually use it. Built as a fresh array rather than mutating the
  // module-level NAV_SECTIONS, which would leak across requests.
  const sections = user.roles.includes("SUPER_ADMIN")
    ? NAV_SECTIONS.map((section) =>
        section.label === "System"
          ? { ...section, items: [...section.items, { label: "Styleguide", href: "/admin/styleguide" }] }
          : section,
      )
    : NAV_SECTIONS;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="relative flex flex-row items-center gap-2 overflow-hidden px-3 py-2">
        {/* DESIGN.md section 4.1: a faint amber glow behind the logo,
            the same light the check-in count glows with, just quieter
            here. Purely decorative, so it is inert to assistive tech. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-4 -top-4 size-24 rounded-full bg-amber-500/20 blur-2xl"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static asset, not one next/image needs to optimise */}
        <img src="/logo.png" alt="" width={32} height={32} className="relative shrink-0" />
        <div className="relative min-w-0">
          <p className="truncate font-heading text-sm font-bold">Anwaru-l-Huda League</p>
          <p className="truncate text-xs text-sidebar-foreground/70">Administration</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    {item.href ? (
                      <SidebarMenuButton render={<Link href={item.href}>{item.label}</Link>} />
                    ) : (
                      <SidebarMenuButton disabled>{item.label}</SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-2 px-3 py-2">
        {/* text-muted-foreground is tuned for a light surface (DESIGN.md
            section 2); the sidebar is navy-900, so its own foreground
            token, dimmed, is what actually reads here. */}
        <p className="truncate text-xs text-sidebar-foreground/70">
          {user.email ?? user.phone ?? "Signed in"}
        </p>
        <SignOutButton />
      </SidebarFooter>
    </Sidebar>
  );
}
