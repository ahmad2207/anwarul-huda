import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findPotentialDuplicates } from "@/lib/duplicates";
import { formatNigerianPhoneForDisplay } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";
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
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-muted text-left">
              <tr>
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Wing</th>
                <th className="p-2 font-medium">Phone</th>
                <th className="p-2 font-medium">Gender</th>
                <th className="p-2 font-medium">Registered</th>
                <th className="p-2 font-medium">Duplicates</th>
                <th className="p-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withDuplicates.map(({ member, duplicates }) => (
                <tr key={member.id} className="border-b align-top last:border-0 hover:bg-muted/30">
                  <td className="p-2 font-medium">
                    {member.surname} {member.firstName} {member.otherNames ?? ""}
                  </td>
                  <td className="p-2">{member.wing.name}</td>
                  <td className="p-2">{formatNigerianPhoneForDisplay(member.phone)}</td>
                  <td className="p-2">{member.gender === "MALE" ? "Male" : "Female"}</td>
                  <td className="p-2">{member.createdAt.toLocaleDateString("en-NG")}</td>
                  <td className="p-2">
                    {duplicates.length === 0 ? (
                      <StatusTag tone="neutral">None</StatusTag>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <StatusTag tone="attention">
                          {duplicates.length} possible {duplicates.length === 1 ? "match" : "matches"}
                        </StatusTag>
                        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {duplicates.map((duplicate) => (
                            <li key={duplicate.member.id}>
                              {duplicate.member.surname} {duplicate.member.firstName} (
                              {duplicate.member.memberNumber ?? duplicate.member.status.toLowerCase()}),{" "}
                              {duplicate.matchedOnPhone
                                ? "same phone"
                                : `${Math.round(duplicate.nameSimilarity * 100)}% name match`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={approveMember}>
                        <input type="hidden" name="memberId" value={member.id} />
                        <Button type="submit" size="sm">
                          Approve
                        </Button>
                      </form>
                      <RejectMemberForm memberId={member.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
