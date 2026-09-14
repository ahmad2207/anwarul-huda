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

// Structural navigation only. Every item below points at a route that a
// later phase builds. None of them are feature pages yet.
const NAV_SECTIONS: Array<{ label: string; items: string[] }> = [
  {
    label: "Membership",
    items: ["Members", "Approval queue", "Import"],
  },
  {
    label: "Finance",
    items: ["Payments", "Cash sessions", "Reports"],
  },
  {
    label: "Charity",
    items: ["Beneficiary cases", "Disbursements", "Dashboard"],
  },
  {
    label: "Attendance",
    items: ["Gatherings", "Check-in"],
  },
  {
    label: "Content",
    items: ["Sermons", "Weekly books"],
  },
  {
    label: "System",
    items: ["Users", "Audit log"],
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
                  <SidebarMenuItem key={item}>
                    <SidebarMenuButton disabled>{item}</SidebarMenuButton>
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
