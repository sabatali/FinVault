import mongoose, { type ClientSession } from "mongoose";

function isReplicaSetTransactionError(error: unknown): boolean {
  const candidates: unknown[] = [error];

  if (typeof error === "object" && error !== null && "originalError" in error) {
    candidates.push((error as { originalError: unknown }).originalError);
  }

  for (const candidate of candidates) {
    if (!(candidate instanceof Error)) {
      continue;
    }

    const message = candidate.message.toLowerCase();
    if (
      message.includes("replica set") ||
      message.includes("transaction numbers are only allowed") ||
      message.includes("multi-document transactions") ||
      message.includes("retryable writes")
    ) {
      return true;
    }

    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      (candidate as { code: number }).code === 20
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Runs work inside a MongoDB transaction when the deployment supports it.
 * Falls back to sequential writes (no session) on standalone MongoDB instances.
 */
export async function withOptionalTransaction<T>(
  fn: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    let result!: T;

    try {
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } catch (error) {
      if (isReplicaSetTransactionError(error)) {
        console.warn(
          "[finvault] MongoDB transactions unavailable; using sequential writes. Run rs.initiate() in mongosh for full ledger safety.",
        );
        return fn(null);
      }
      throw error;
    }
  } finally {
    await session.endSession();
  }
}
