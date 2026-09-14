import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findPotentialDuplicates } from "@/lib/duplicates";
import { formatNigerianPhoneForDisplay } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { approveMember } from "./actions";
import { RejectMemberForm } from "./reject-member-form";

export default async function ApprovalsPage() {
  const user = await requireRole(["WING_ADMIN"]);
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");

  const pendingMembers = await prisma.member.findMany({
    where: {
      status: "PENDING",
      ...(isSuperAdmin ? {} : { wingId: { in: user.wingIds } }),
    },
    include: { wing: true },
    orderBy: { createdAt: "asc" },
  });

  const withDuplicates = await Promise.all(
    pendingMembers.map(async (member) => ({
      member,
      duplicates: await findPotentialDuplicates(prisma, {
        id: member.id,
        phone: member.phone,
        surname: member.surname,
        firstName: member.firstName,
      }),
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Approval queue</h1>
        <p className="text-sm text-muted-foreground">
          {pendingMembers.length} pending registration{pendingMembers.length === 1 ? "" : "s"}
        </p>
      </div>

      {withDuplicates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing waiting for approval.</p>
      ) : null}

      {withDuplicates.map(({ member, duplicates }) => (
        <Card key={member.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base font-medium">
              <span>
                {member.surname} {member.firstName} {member.otherNames ?? ""}
              </span>
              <span className="text-xs font-normal text-muted-foreground">{member.wing.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{formatNigerianPhoneForDisplay(member.phone)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Gender</dt>
                <dd>{member.gender === "MALE" ? "Male" : "Female"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Registered</dt>
                <dd>{member.createdAt.toLocaleDateString("en-NG")}</dd>
              </div>
            </dl>

            {duplicates.length > 0 ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
                <p className="mb-2 font-medium text-amber-900 dark:text-amber-200">
                  Possible duplicate{duplicates.length === 1 ? "" : "s"}
                </p>
                <ul className="flex flex-col gap-1">
                  {duplicates.map((duplicate) => (
                    <li
                      key={duplicate.member.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span>
                        {duplicate.member.surname} {duplicate.member.firstName} (
                        {duplicate.member.memberNumber ?? duplicate.member.status.toLowerCase()})
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {duplicate.matchedOnPhone
                          ? "same phone"
                          : `${Math.round(duplicate.nameSimilarity * 100)}% name match`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <form action={approveMember}>
                <input type="hidden" name="memberId" value={member.id} />
                <Button type="submit">Approve</Button>
              </form>
              <RejectMemberForm memberId={member.id} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
