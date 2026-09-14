import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenSessionForm, SessionRow } from "./session-views";

export default async function CashSessionsPage() {
  await requireRole(["FINANCE_OFFICER"]);

  const sessions = await prisma.cashSession.findMany({
    include: { openedBy: true, closedBy: true },
    orderBy: { openedAt: "desc" },
    take: 30,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Cash sessions</h1>
        <p className="text-sm text-muted-foreground">
          Open a session before recording cash payments. Close it by counting the cash. A closed session
          cannot be reopened.
        </p>
      </div>

      <OpenSessionForm />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Sessions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
