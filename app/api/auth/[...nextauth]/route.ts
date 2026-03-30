// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/firebaseAdmin";
// import { NextRequest } from "next/server";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // ── Runs after Google login ───────────────────
    async signIn({ user }) {
      try {
        const email = user.email!;
        const userRef = db.collection("users").doc(email);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          //  New user — create in Firestore
          const nameParts = (user.name ?? "").split(" ");
          await userRef.set({
            email,
            firstName:  nameParts[0]  ?? "",
            lastName:   nameParts.slice(1).join(" ") ?? "",
            avatar:     user.image    ?? "",
            provider:   "google",
            isVerified: true,
            status:     "active",
            role:       "user",
            createdAt:  Date.now(),
            updatedAt:  Date.now(),
          });
        } else {
          const data = userDoc.data()!;

          //  Block disabled users
          if (data.status === "disabled") {
            return false;
          }

          //  Update last login time
          await userRef.update({
            lastLoginAt: Date.now(),
            updatedAt:   Date.now(),
          });
        }

        return true;
      } catch (error) {
        console.error("Google signIn error:", error);
        return false;
      }
    },

    // ── Add user data to the token ────────────────
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        try {
          const userDoc = await db.collection("users").doc(user.email).get();
          if (userDoc.exists) {
            const data = userDoc.data()!;
            token.role   = data.role   ?? "user";
            token.status = data.status ?? "active";
            token.dbUser = {
              email:     data.email,
              firstName: data.firstName,
              lastName:  data.lastName,
              role:      data.role   ?? "user",
              status:    data.status ?? "active",
            };
          }
        } catch (error) {
          console.error("JWT callback error:", error);
        }
      }
      return token;
    },

    //  Expose token data to session
    async session({ session, token }) {
      if (token.dbUser) {
        session.user = {
          ...session.user,
          ...(token.dbUser as object),
        };
      }
      return session;
    },
  },

  pages: {
    signIn:  "/auth/login",
    error:   "/auth/login",
  },

  session: { strategy: "jwt" },
});

export const GET = handler;
export const POST = handler;