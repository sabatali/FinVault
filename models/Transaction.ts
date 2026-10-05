import mongoose, { Schema, type Document, type Model } from "mongoose";

export const TRANSACTION_SOURCE_TYPES = [
  "opening_balance",
  "expense",
  "income",
  "group_expense",
  "group_transfer",
  "adjustment",
] as const;

export type TransactionSourceType = (typeof TRANSACTION_SOURCE_TYPES)[number];

export const TRANSACTION_ENTRY_TYPES = ["credit", "debit"] as const;
export type TransactionEntryType = (typeof TRANSACTION_ENTRY_TYPES)[number];

export interface ITransaction extends Document {
  account: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  entryType: TransactionEntryType;
  amount: number;
  currency: string;
  sourceType: TransactionSourceType;
  sourceId: mongoose.Types.ObjectId;
  description: string;
  occurredAt: Date;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      required: true,
      enum: TRANSACTION_ENTRY_TYPES,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: "PKR",
      uppercase: true,
      match: /^[A-Z]{3}$/,
    },
    sourceType: {
      type: String,
      required: true,
      enum: TRANSACTION_SOURCE_TYPES,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 200,
      trim: true,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

transactionSchema.index({ account: 1, occurredAt: -1 });
transactionSchema.index({ user: 1, occurredAt: -1 });
transactionSchema.index(
  { sourceType: 1, sourceId: 1, account: 1 },
  { unique: true },
);

export interface TransactionPublic {
  id: string;
  entryType: TransactionEntryType;
  amount: number;
  currency: string;
  sourceType: TransactionSourceType;
  sourceId: string;
  description: string;
  occurredAt: string;
  /** Deep link to the originating document when available. */
  sourceHref?: string | null;
  groupExpense?: {
    yourShare: number;
    othersShare: number;
    groupId: string;
    groupName: string;
  };
}

export function toTransactionPublic(
  transaction: ITransaction,
  extras?: {
    sourceHref?: string | null;
    groupExpense?: TransactionPublic["groupExpense"];
  },
): TransactionPublic {
  return {
    id: transaction._id.toString(),
    entryType: transaction.entryType,
    amount: transaction.amount,
    currency: transaction.currency,
    sourceType: transaction.sourceType,
    sourceId: transaction.sourceId.toString(),
    description: transaction.description,
    occurredAt: transaction.occurredAt.toISOString(),
    ...(extras?.sourceHref !== undefined
      ? { sourceHref: extras.sourceHref }
      : {}),
    ...(extras?.groupExpense !== undefined
      ? { groupExpense: extras.groupExpense }
      : {}),
  };
}

export const Transaction: Model<ITransaction> =
  (mongoose.models.Transaction as Model<ITransaction> | undefined) ??
  mongoose.model<ITransaction>("Transaction", transactionSchema);
