import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { getFxSnapshot } from "@/lib/fx";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const snapshot = getFxSnapshot();
  return NextResponse.json(snapshot);
}
