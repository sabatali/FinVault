import mongoose, { type ClientSession } from "mongoose";

import { TransactionsUnavailableError } from "@/lib/ledger-errors";

export function isReplicaSetTransactionError(error: unknown): boolean {
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

function allowNonTransactionalWrites(): boolean {
  return (
    process.env.ALLOW_NON_TRANSACTIONAL_WRITES === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

/**
 * Always runs work inside a MongoDB transaction. Throws
 * TransactionsUnavailableError when the deployment is not a replica set.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
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
        throw new TransactionsUnavailableError();
      }
      throw error;
    }
  } finally {
    await session.endSession();
  }
}

/**
 * Prefer {@link withTransaction}. Falls back to sequential writes only when
 * ALLOW_NON_TRANSACTIONAL_WRITES=true in a non-production environment.
 */
export async function withOptionalTransaction<T>(
  fn: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  if (!allowNonTransactionalWrites()) {
    return withTransaction(fn);
  }

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
        console.error(
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
