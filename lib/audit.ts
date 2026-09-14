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

/**
 * Same as writeAudit, but for writing many entries in one round trip, for
 * a bulk operation such as a CSV import commit or an import batch
 * rollback touching thousands of members. createMany does not run the
 * same per-row hooks a series of individual creates would, but every
 * entry here is already a plain, independent audit row, so that does not
 * matter here.
 */
export async function writeAuditMany(
  inputs: WriteAuditInput[],
  client: PrismaClientOrTransaction = prisma,
): Promise<void> {
  if (inputs.length === 0) return;

  await client.auditLog.createMany({
    data: inputs.map((input) => ({
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: toJsonInput(input.before),
      after: toJsonInput(input.after),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })),
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
