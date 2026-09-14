import { NextRequest, NextResponse } from "next/server";

import {
  attachAuthCookie,
  hashPassword,
  signToken,
} from "@/lib/auth";
import { claimGuestMembershipsForUser } from "@/lib/claim";
import { connectDB } from "@/lib/db";
import { formatZodErrors, signupSchema } from "@/lib/validators/auth";
import { withOptionalTransaction } from "@/lib/with-transaction";
import { toUserPublic, User } from "@/models/User";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: number }).code === 11000
  );
}

export async function POST(request: NextRequest) {
  if (!process.env.JWT_SECRET) {
    return NextResponse.json(
      { error: "Authentication is not configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: formatZodErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  const { name, email, password, preferredCurrency, invite } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    await connectDB();

    const passwordHash = await hashPassword(password);

    const { user, claimResult } = await withOptionalTransaction(
      async (session) => {
        const opts = session ? { session } : undefined;
        const [created] = await User.create(
          [
            {
              name,
              email: normalizedEmail,
              passwordHash,
              preferredCurrency: preferredCurrency ?? "PKR",
            },
          ],
          opts,
        );

        const result = await claimGuestMembershipsForUser(created!, session, {
          inviteToken: invite,
        });

        return { user: created!, claimResult: result };
      },
    );

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
    });

    const response = NextResponse.json(
      {
        user: toUserPublic(user),
        claimedGroups: claimResult.claimed,
        ...(claimResult.inviteWarning
          ? { inviteWarning: claimResult.inviteWarning }
          : {}),
      },
      { status: 201 },
    );

    return attachAuthCookie(response, token);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Unable to create account" },
      { status: 500 },
    );
  }
}
