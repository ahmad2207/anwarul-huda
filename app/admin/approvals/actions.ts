"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, requireWingAccess } from "@/lib/auth";
import { generateMemberNumber } from "@/lib/member-number";
import { writeAudit } from "@/lib/audit";
import { approveMemberSchema, rejectMemberSchema } from "./schema";

export async function approveMember(formData: FormData): Promise<void> {
  const parsed = approveMemberSchema.safeParse({ memberId: formData.get("memberId") });
  if (!parsed.success) {
    throw new Error("Missing member id.");
  }

  const actor = await requireRole(["WING_ADMIN"]);

  const member = await prisma.member.findUnique({
    where: { id: parsed.data.memberId },
    include: { wing: true, user: true },
  });
  if (!member) {
    throw new Error("This member record no longer exists.");
  }

  await requireWingAccess(member.wingId);

  if (member.status !== "PENDING") {
    throw new Error("This record has already been decided.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const memberNumber = await generateMemberNumber(tx, {
        wingId: member.wingId,
        wingNumberLetter: member.wing.numberLetter,
      });

      const updated = await tx.member.update({
        where: { id: member.id },
        data: {
          memberNumber,
          status: "ACTIVE",
          approvedById: actor.id,
          approvedAt: new Date(),
        },
      });

      // A member who came through public self-registration already has a
      // linked User, created inactive with the password they chose at
      // registration (see app/register). Approval just activates it,
      // rather than creating a second account. A member who reached
      // PENDING some other way (for example entered directly by an
      // admin for review) has no linked User yet, so one is created here
      // with no password set, which fails safe: lib/auth.ts's authorize()
      // already refuses a null password hash rather than letting anyone
      // in until a password is set some other way.
      let userId: string;
      let userAuditAction: string;
      let userBefore: { isActive: boolean } | null;
      if (member.user) {
        const updatedUser = await tx.user.update({
          where: { id: member.user.id },
          data: { isActive: true },
        });
        userId = updatedUser.id;
        userAuditAction = "user.activated";
        userBefore = { isActive: member.user.isActive };
      } else {
        const createdUser = await tx.user.create({
          data: {
            email: member.email,
            phone: member.phone,
            isActive: true,
            memberId: member.id,
          },
        });
        userId = createdUser.id;
        userAuditAction = "user.created";
        userBefore = null;
      }

      await writeAudit(
        {
          actorId: actor.id,
          action: "member.approved",
          entity: "Member",
          entityId: member.id,
          before: { status: member.status },
          after: { status: updated.status, memberNumber: updated.memberNumber },
        },
        tx,
      );

      // A separate entry for the User write itself (CLAUDE.md domain rule
      // 7 names "users" as its own audited entity, distinct from the
      // member record), so filtering the audit log by entity "User" shows
      // this, not only an entry filed under "Member".
      await writeAudit(
        {
          actorId: actor.id,
          action: userAuditAction,
          entity: "User",
          entityId: userId,
          before: userBefore,
          after: { isActive: true },
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("A user account with this phone or email already exists.");
    }
    throw error;
  }

  revalidatePath("/admin/approvals");
}

export async function rejectMember(
  _previousState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = rejectMemberSchema.safeParse({
    memberId: formData.get("memberId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the values you entered and try again.";
  }

  const actor = await requireRole(["WING_ADMIN"]);

  const member = await prisma.member.findUnique({ where: { id: parsed.data.memberId } });
  if (!member) {
    return "This member record no longer exists.";
  }

  try {
    await requireWingAccess(member.wingId);
  } catch {
    return "You do not have access to this wing.";
  }

  if (member.status !== "PENDING") {
    return "This record has already been decided.";
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.member.update({
      where: { id: member.id },
      data: {
        status: "REJECTED",
        statusReason: parsed.data.reason,
        statusAt: new Date(),
      },
    });

    await writeAudit(
      {
        actorId: actor.id,
        action: "member.rejected",
        entity: "Member",
        entityId: member.id,
        before: { status: member.status },
        after: { status: updated.status, statusReason: updated.statusReason },
      },
      tx,
    );
  });

  revalidatePath("/admin/approvals");
  return undefined;
}
