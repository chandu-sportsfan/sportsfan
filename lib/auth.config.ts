// lib/auth.config.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/firebaseAdmin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      try {
        const email = user.email!;
        const userRef = db.collection("users").doc(email);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          const nameParts = (user.name ?? "").split(" ");
          await userRef.set({
            email,
            firstName:  nameParts[0]  ?? "",
            lastName:   nameParts.slice(1).join(" ") ?? "",
            userId: `google_${email.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`,
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
          if (data.status === "disabled") return false;
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
               userId:    data.userId,
            };
          }
        } catch (error) {
          console.error("JWT callback error:", error);
        }
      }
      return token;
    },

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
    signIn: "/auth/login",
    error:  "/auth/login",
  },

  session: { strategy: "jwt" },
});