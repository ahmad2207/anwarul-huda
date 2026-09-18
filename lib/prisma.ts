import { PrismaClient } from "@prisma/client";

// Reuse the client across hot reloads in development so we do not open a
// new connection pool on every file change.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Constructed on first use, not on import: Next evaluates every route
// module during "Collecting page data" at build time, so a client built
// at module scope was throwing there for any route reachable from this
// file whenever DATABASE_URL was not resolvable at build time, no matter
// that route's own rendering mode. Deferring construction moves that
// failure to the first query a request actually makes.
let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (!client) {
    client = globalForPrisma.prisma ?? new PrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }
  }
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const instance = getClient();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
