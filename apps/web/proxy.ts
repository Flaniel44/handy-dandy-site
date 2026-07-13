import { NextRequest, NextResponse } from "next/server";

import { isTrustedMutation } from "./lib/request-security";

export function proxy(request: NextRequest) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
