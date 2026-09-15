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
    items: [{ label: "Upload", href: "/admin/content" }],
  },
  {
    label: "System",
    items: [{ label: "Users" }, { label: "Audit log", href: "/admin/audit" }],
  },
];

export function AdminSidebar({ user }: { user: CurrentUser }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-2">
        <p className="text-sm font-semibold">Anwar-ul-Huda League</p>
        <p className="text-xs text-muted-foreground">Administration</p>
      </SidebarHeader>
      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
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
        <p className="truncate text-xs text-muted-foreground">
          {user.email ?? user.phone ?? "Signed in"}
        </p>
        <SignOutButton />
      </SidebarFooter>
    </Sidebar>
  );
}
