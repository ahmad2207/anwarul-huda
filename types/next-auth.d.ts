import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    roles: string[];
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    roles: string[];
    /** Absent on tokens issued before session versioning; read as 0. */
    sessionVersion?: number;
  }
}
