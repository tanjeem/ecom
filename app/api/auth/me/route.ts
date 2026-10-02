import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Who is signed in — set by proxy.ts after verifying the session. */
export function GET(req: NextRequest) {
  return NextResponse.json({ user: req.headers.get('x-auth-user'), role: req.headers.get('x-auth-role') || 'admin' });
}
