// lib/isAdmin.ts
const ADMIN_EMAILS = (process.env.ROAR_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());

export function isAdmin(user: { email: string }) {
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}