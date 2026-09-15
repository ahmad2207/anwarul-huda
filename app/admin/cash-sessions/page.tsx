import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
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
      <PageHeader
        title="Cash sessions"
        description="Open a session before recording cash payments. Close it by counting the cash. A closed session cannot be reopened."
      />

      <OpenSessionForm />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Sessions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
          {sessions.length === 0 ? <EmptyState message="No sessions yet. Open one above to start." /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
