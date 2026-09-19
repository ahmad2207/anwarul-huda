import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canViewAllWings } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { generateMemberQrDataUrl } from "@/lib/qr/member-qr";
import { MemberCard } from "../../member-card";
import { PrintButton } from "@/app/admin/charity/print/print-button";
import { BackLink } from "@/components/back-link";

export default async function MemberCardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["WING_ADMIN", "FINANCE_OFFICER", "ATTENDANCE_OFFICER"]);
  const { id } = await params;

  const member = await prisma.member.findUnique({ where: { id }, include: { wing: true } });
  if (!member || !member.memberNumber) {
    notFound();
  }
  if (!canViewAllWings(user) && !user.wingIds.includes(member.wingId)) {
    notFound();
  }

  const qrDataUrl = await generateMemberQrDataUrl(member.memberNumber);

  return (
    <div className="flex flex-col items-center gap-4">
      <BackLink href={`/admin/members/${id}`} label="Back to member" className="print:hidden self-start" />
      <div className="print:hidden">
        <PrintButton />
      </div>
      <MemberCard
        memberName={`${member.surname} ${member.firstName}`}
        memberNumber={member.memberNumber}
        wingName={member.wing.name}
        qrDataUrl={qrDataUrl}
      />
    </div>
  );
}
