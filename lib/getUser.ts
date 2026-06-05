import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export async function getUser(req: NextRequest): Promise<AuthUser | null> {
  const cookieToken = req.cookies.get("token")?.value;
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, process.env.JWT_SECRET!) as {
        email?: string;
        userId?: string;
        uid?: string;
        id?: string;
        name?: string;
        role?: string;
      };
      const userId =
        payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) {
        return {
          userId,
          email: payload.email,
          name: payload.name ?? "",
          role: payload.role ?? "user",
        };
      }
    } catch {
      /* fall through */
    }
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    try {
      const payload = jwt.verify(bearerToken, process.env.JWT_SECRET!) as {
        email?: string;
        userId?: string;
        uid?: string;
        id?: string;
        name?: string;
        role?: string;
      };
      const userId =
        payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) {
        return {
          userId,
          email: payload.email,
          name: payload.name ?? "",
          role: payload.role ?? "user",
        };
      }
    } catch {
      /* invalid */
    }
  }

  return null;
}
