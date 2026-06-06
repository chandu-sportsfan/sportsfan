import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const adminToken = req.cookies.get("admin_token")?.value;

  let tokenPayload = null;
  let tokenError = null;
  let adminTokenPayload = null;
  let adminTokenError = null;

  const secret = process.env.JWT_SECRET;

  if (token) {
    try {
      tokenPayload = jwt.verify(token, secret!);
    } catch (err: any) {
      tokenError = err.message;
    }
  }

  if (adminToken) {
    try {
      adminTokenPayload = jwt.verify(adminToken, secret!);
    } catch (err: any) {
      adminTokenError = err.message;
    }
  }

  return NextResponse.json({
    hasSecret: !!secret,
    secretLength: secret ? secret.length : 0,
    cookiesPresent: {
      token: !!token,
      adminToken: !!adminToken,
    },
    tokenPayload,
    tokenError,
    adminTokenPayload,
    adminTokenError,
  });
}
