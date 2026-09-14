import type { Prisma } from "@prisma/client";

// A named, transaction scoped Postgres advisory lock: the lock name is
// folded into a bigint key (what pg_advisory_xact_lock actually takes),
// and released automatically when the transaction commits or rolls back.
// Used anywhere a sequence number has to be generated safely under
// concurrency without a bare, race prone count query, and without a
// dedicated counter table or schema object.
export async function withNamedLock(tx: Prisma.TransactionClient, name: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey(name)})`;
}

// Collisions between different names are extremely unlikely, and only
// cost a little unnecessary serialisation between unrelated operations,
// never an incorrect result: two different names never care about each
// other's lock, so a shared key just makes both wait their turn.
function lockKey(name: string): bigint {
  const multiplier = BigInt(31);
  const mask = BigInt("0x7fffffffffffffff");
  let hash = BigInt(0);
  for (let i = 0; i < name.length; i++) {
    hash = (hash * multiplier + BigInt(name.charCodeAt(i))) & mask;
  }
  return hash;
}
