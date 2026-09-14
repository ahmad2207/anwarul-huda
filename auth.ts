import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeNigerianPhone } from "@/lib/phone";

// Auth.js with the Credentials provider only supports the "jwt" session
// strategy. Database sessions rely on the adapter's account linking flow,
// which credentials login never goes through, so we do not configure a
// Prisma adapter here. The session itself is a signed JWT, not a database
// row. Revocation is by deactivating the User (isActive) or rotating
// AUTH_SECRET, not by deleting a session record.

const credentialsSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Email or phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }
        const { identifier, password } = parsed.data;

        const user = await findUserByIdentifier(identifier);
        if (!user || !user.isActive || !user.passwordHash) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

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

async function findUserByIdentifier(identifier: string) {
  const isEmail = identifier.includes("@");

  if (isEmail) {
    return prisma.user.findUnique({
      where: { email: identifier.toLowerCase() },
      include: { roles: true },
    });
  }

  try {
    const phone = normalizeNigerianPhone(identifier);
    return await prisma.user.findUnique({
      where: { phone },
      include: { roles: true },
    });
  } catch {
    return null;
  }
}
