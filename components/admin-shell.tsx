"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { CurrentUser } from "@/lib/auth";

// The gatherings list and every attendance report still gets the sidebar
// shell; only a specific gathering's own check-in screen
// (/admin/attendance/<id>) does not, since DESIGN.md section 4.3 makes
// it its own full bleed surface, deliberately not another admin page.
function isCheckInRoute(pathname: string): boolean {
  return pathname.startsWith("/admin/attendance/") && !pathname.startsWith("/admin/attendance/reports");
}

export function AdminShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const pathname = usePathname();

  if (isCheckInRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AdminSidebar user={user} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 print:hidden">
          <SidebarTrigger />
          <span className="text-sm font-medium">Anwaru-l-Huda League administration</span>
        </header>
        {/* DESIGN.md section 4.1: 14px base for the admin desk, a dense
            table on a laptop, not the member area's 17px. */}
        <main className="flex-1 p-6 text-sm">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
