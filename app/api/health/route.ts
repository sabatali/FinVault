import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { connectDB, getMongoReadyState } from "@/lib/db";

export async function GET() {
  const env = process.env.NODE_ENV ?? "development";

  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      {
        ok: false,
        app: "finvault",
        env,
        db: {
          connected: false,
          readyState: 0,
          error: "MONGODB_URI is not configured",
        },
      },
      { status: 503 },
    );
  }

  try {
    await connectDB();

    const db = mongoose.connection.db;
    if (db) {
      await db.admin().ping();
    }

    let transactions = false;
    let replicaSet: string | null = null;
    if (db) {
      const hello = (await db.admin().command({ hello: 1 })) as {
        setName?: string;
      };
      replicaSet = hello.setName ?? null;
      transactions = Boolean(hello.setName);
    }

    return NextResponse.json({
      ok: true,
      app: "finvault",
      env,
      db: {
        connected: true,
        readyState: getMongoReadyState(),
        transactions,
        replicaSet,
      },
      ...(transactions
        ? {}
        : {
            warnings: [
              "MongoDB is not a replica set — ledger writes will be rejected",
            ],
          }),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        app: "finvault",
        env,
        db: {
          connected: false,
          readyState: getMongoReadyState(),
          error: "MongoDB connection failed",
        },
      },
      { status: 503 },
    );
  }
}
