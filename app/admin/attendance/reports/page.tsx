import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AttendanceReportsPage() {
  await requireRole(["ATTENDANCE_OFFICER", "WING_ADMIN"]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Attendance reports</h1>
        <p className="text-sm text-muted-foreground">All exportable to CSV.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Per gathering</CardTitle>
          <CardDescription>How many checked in to each gathering, filterable by type and date.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/admin/attendance/reports/gatherings">Open</Link>} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Per member</CardTitle>
          <CardDescription>Every gathering a given member checked in to over a period.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/admin/attendance/reports/member">Open</Link>} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Rate per wing</CardTitle>
          <CardDescription>The average share of a wing that shows up to a gathering, over a period.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/admin/attendance/reports/wings">Open</Link>} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Not attended recently</CardTitle>
          <CardDescription>Active members who have not attended anything in a given number of weeks.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/admin/attendance/reports/inactive">Open</Link>} />
        </CardContent>
      </Card>
    </div>
  );
}
