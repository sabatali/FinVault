import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { findGuestInviteByToken } from "@/lib/invite";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { token } = await context.params;

  try {
    await connectDB();
    const invite = await findGuestInviteByToken(token);

    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found", code: "INVITE_INVALID" },
        { status: 404 },
      );
    }

    if (invite.expired) {
      return NextResponse.json(
        {
          error: "Invite expired, ask an admin to resend.",
          code: "INVITE_EXPIRED",
          email: invite.member.email,
          groupName: invite.groupName,
          expired: true,
        },
        { status: 410 },
      );
    }

    return NextResponse.json({
      email: invite.member.email,
      displayName: invite.member.displayName,
      groupName: invite.groupName,
      expired: false,
    });
  } catch (error) {
    console.error("Invite preview error:", error);
    return NextResponse.json(
      { error: "Unable to load invite" },
      { status: 500 },
    );
  }
}
