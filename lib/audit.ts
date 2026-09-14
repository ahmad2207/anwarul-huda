import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Any later mutation to members, payments, disbursements or users must call
// this inside the same database transaction as the mutation itself, so the
// audit entry and the change it describes commit or fail together.

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

export interface WriteAuditInput {
  /** The user who performed the action. Null for system actions with no signed in user. */
  actorId: string | null;
  /** A short, stable, dot-separated action name, for example "member.approved" or "payment.voided". */
  action: string;
  /** The entity type, for example "Member" or "Payment". */
  entity: string;
  /** The id of the affected row. */
  entityId: string;
  /** The row state before the change, or null for a creation. */
  before?: unknown;
  /** The row state after the change, or null for a deletion. Members and payments are never deleted, so this is usually present. */
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAudit(
  input: WriteAuditInput,
  client: PrismaClientOrTransaction = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: toJsonInput(input.before),
      after: toJsonInput(input.after),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }
  // Round-trip through JSON so Date objects, Decimal-like values and class
  // instances are stored as plain, comparable JSON rather than failing to
  // serialise or storing a class reference.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
