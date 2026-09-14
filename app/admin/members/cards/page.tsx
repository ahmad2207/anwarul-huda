import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { generateMemberQrDataUrl } from "@/lib/qr/member-qr";
import { MemberCard } from "../member-card";
import { PrintButton } from "@/app/admin/charity/print/print-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const CARDS_PER_PAGE = 8;

export default async function MemberCardsSheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(["WING_ADMIN", "FINANCE_OFFICER", "ATTENDANCE_OFFICER"]);
  const params = await searchParams;
  const wingId = typeof params.wingId === "string" ? params.wingId : "";

  const wings = await prisma.wing.findMany({ orderBy: { name: "asc" } });
  const visibleWings = canViewAllWings(user) ? wings : wings.filter((w) => user.wingIds.includes(w.id));

  const members = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      memberNumber: { not: null },
      ...(wingId ? { wingId } : canViewAllWings(user) ? {} : { wingId: { in: user.wingIds } }),
    },
    include: { wing: true },
    orderBy: [{ surname: "asc" }, { firstName: "asc" }],
    take: 400,
  });

  const cards = await Promise.all(
    members.map(async (member) => ({
      member,
      qrDataUrl: await generateMemberQrDataUrl(member.memberNumber!),
    })),
  );

  const pages: (typeof cards)[] = [];
  for (let i = 0; i < cards.length; i += CARDS_PER_PAGE) {
    pages.push(cards.slice(i, i + CARDS_PER_PAGE));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-lg font-semibold">Member cards</h1>
          <p className="text-sm text-muted-foreground">
            {cards.length} card{cards.length === 1 ? "" : "s"}, eight to a page.
          </p>
        </div>
        <PrintButton />
      </div>

      <Card className="print:hidden">
        <CardContent className="pt-6">
          <form method="get" className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Wing</Label>
              <select
                name="wingId"
                defaultValue={wingId}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">{canViewAllWings(user) ? "All wings" : "My wing"}</option>
                {visibleWings.map((wing) => (
                  <option key={wing.id} value={wing.id}>
                    {wing.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      {pages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="grid grid-cols-2 gap-4"
          style={{ pageBreakAfter: pageIndex < pages.length - 1 ? "always" : "auto" }}
        >
          {page.map(({ member, qrDataUrl }) => (
            <MemberCard
              key={member.id}
              memberName={`${member.surname} ${member.firstName}`}
              memberNumber={member.memberNumber!}
              wingName={member.wing.name}
              qrDataUrl={qrDataUrl}
            />
          ))}
        </div>
      ))}

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members with an issued number match this filter.</p>
      ) : null}
    </div>
  );
}
