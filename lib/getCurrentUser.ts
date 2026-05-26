// lib/getCurrentUser.ts
// Shared auth helper for chat API routes.
// Tries (1) NextAuth Google session, (2) JWT cookie (email/password users).

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth.config";
import jwt from "jsonwebtoken";

interface CurrentUser {
  userId: string;
  email:  string;
  name:   string;
  role:   string;
}

export async function getCurrentUser(req: NextRequest): Promise<CurrentUser | null> {
  // ── 1. NextAuth session (Google users) ──────────────────────────────────────
  try {
    const sessionVal = await auth();
    const su = (sessionVal?.user ?? undefined) as { userId?: string; email?: string; name?: string; role?: string } | undefined;
    if (su?.email) {
      return {
        userId: su.userId ?? su.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_"),
        email:  su.email,
        name:   su.name  ?? "",
        role:   su.role  ?? "user",
      };
    }
  } catch {
    // session() can throw outside RSC — fall through to JWT
  }

  // ── 2. JWT cookie (email / OTP users) ───────────────────────────────────────
  const token = req.cookies.get("token")?.value;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
        userId?: string;
        email?:  string;
        name?:   string;
        role?:   string;
      };
      if (payload.email) {
        return {
          userId: payload.userId ?? payload.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_"),
          email:  payload.email,
          name:   payload.name  ?? "",
          role:   payload.role  ?? "user",
        };
      }
    } catch {
      // Invalid / expired token
    }
  }

  return null;
}