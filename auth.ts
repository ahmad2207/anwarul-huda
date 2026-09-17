import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { classifyLoginIdentifier } from "@/lib/login-identifier";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  accountLockoutKey,
  checkAccountLockout,
  clearAccountLockout,
  recordLoginFailure,
  unknownIdentifierLockoutKey,
} from "@/lib/login-lockout";

// Auth.js with the Credentials provider only supports the "jwt" session
// strategy. Database sessions rely on the adapter's account linking flow,
// which credentials login never goes through, so we do not configure a
// Prisma adapter here. The session itself is a signed JWT, not a database
// row. Revocation is by deactivating the User (isActive) or rotating
// AUTH_SECRET, not by deleting a session record.

// Both rate limiting layers live inside authorize(), not in
// app/login/actions.ts, even though that is the only place in this app
// that calls signIn("credentials", ...). The reason is that authorize()
// is also reachable directly, at /api/auth/callback/credentials, without
// going through that action or anything else this app controls: a check
// placed only in the action would do nothing against a request sent
// straight to that route. authorize() is the one choke point neither
// path can avoid, so that is where enforcement has to live. The two
// custom errors below exist so app/login/actions.ts can still show a
// distinct, specific message without recomputing any of this itself.

export class LoginRateLimitedError extends CredentialsSignin {
  code = "rate_limited";
  constructor(public retryAfterSeconds: number) {
    super();
  }
}

export class AccountLockedError extends CredentialsSignin {
  code = "account_locked";
  constructor(public retryAfterSeconds: number) {
    super();
  }
}

const LOGIN_IP_LIMIT = 10;
const LOGIN_IP_WINDOW_SECONDS = 15 * 60;

// Compared against with bcrypt whenever no real account is found, so an
// unknown identifier costs the same wall clock time to refuse as a known
// one with the wrong password. Without this, skipping the compare
// entirely for a nonexistent account is a timing side channel that
// answers exactly the question MEMBER-INTERFACE.md 1 says must not be
// answerable: whether a given member number belongs to anyone. This
// value is not a secret and matches no real account; it exists only to
// give bcrypt.compare something to spend the same effort on.
const DUMMY_PASSWORD_HASH = "$2b$12$v8kyhbd1Dym1H/peeK.9Eutn6m7VUcz3cw7qGCiJj3AZ1ed70VU5S";

const credentialsSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

async function getClientIpForAuthorize(): Promise<string> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0].trim();
    }
    return headerList.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Member number, email or phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }
        const { identifier, password } = parsed.data;

        const ip = await getClientIpForAuthorize();
        const ipLimit = await checkRateLimit(`login-ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_IP_WINDOW_SECONDS);
        if (!ipLimit.allowed) {
          throw new LoginRateLimitedError(ipLimit.retryAfterSeconds ?? LOGIN_IP_WINDOW_SECONDS);
        }

        const classified = classifyLoginIdentifier(identifier);
        const user = await findUserByClassifiedIdentifier(classified);

        // Keyed by the resolved account when there is one, never by the
        // identifier text itself: a member number, an email and a phone
        // number that all resolve to the same user must share one
        // bucket, or trying each in turn gives three times the real
        // allowance. An identifier that resolves to nobody still gets a
        // bucket, namespaced away from every real user id, so probing
        // random member numbers is throttled too, and so that reaching
        // the lockout message never itself reveals which case this was.
        const lockoutKey = user
          ? accountLockoutKey(user.id)
          : unknownIdentifierLockoutKey(classified.kind, classified.canonical);

        const lockout = await checkAccountLockout(lockoutKey);
        if (lockout.locked) {
          throw new AccountLockedError(lockout.retryAfterSeconds ?? 0);
        }

        // Always compared against something, even when there is no user
        // or no password hash to check against for real: see
        // DUMMY_PASSWORD_HASH above.
        const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

        if (!user || !user.isActive || !user.passwordHash || !passwordMatches) {
          await recordLoginFailure(lockoutKey);
          return null;
        }

        await clearAccountLockout(lockoutKey);

        const roles = user.roles.map((userRole) => userRole.role);

        return {
          id: user.id,
          email: user.email,
          roles,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.roles = (user as { roles: string[] }).roles;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.roles = (token.roles as string[]) ?? [];
      }
      return session;
    },
  },
});

/**
 * Resolves whatever was typed into the identifier field to a user
 * account. Member number is tried first (MEMBER-INTERFACE.md 2 makes it
 * the primary login identifier, since a nominal roll member usually has
 * no phone to log in with at all), then email (staff accounts, which
 * have no member number), then phone, kept for a self-registered member
 * who set their own password at registration and has always logged in
 * this way.
 */
async function findUserByClassifiedIdentifier(classified: ReturnType<typeof classifyLoginIdentifier>) {
  if (classified.kind === "memberNumber") {
    return prisma.user.findFirst({
      where: { member: { memberNumber: classified.canonical } },
      include: { roles: true },
    });
  }

  if (classified.kind === "email") {
    return prisma.user.findUnique({
      where: { email: classified.canonical },
      include: { roles: true },
    });
  }

  if (classified.kind === "phone") {
    return prisma.user.findUnique({
      where: { phone: classified.canonical },
      include: { roles: true },
    });
  }

  return null;
}
