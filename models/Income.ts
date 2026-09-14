import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IIncome extends Document {
  user: mongoose.Types.ObjectId;
  account: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  description: string;
  category: mongoose.Types.ObjectId | null;
  occurredAt: Date;
  transactionId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const incomeSchema = new Schema<IIncome>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
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
    description: {
      type: String,
      default: "",
      maxlength: 200,
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    occurredAt: {
      type: Date,
      required: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

incomeSchema.index({ user: 1, occurredAt: -1 });
incomeSchema.index({ account: 1, occurredAt: -1 });
incomeSchema.index({ user: 1, category: 1, occurredAt: -1 });

export interface IncomePublic {
  id: string;
  user: string;
  account: string;
  accountName?: string;
  amount: number;
  currency: string;
  description: string;
  category: string | null;
  categoryName?: string;
  occurredAt: string;
  transactionId: string;
  createdAt: string;
  updatedAt: string;
}

export function toIncomePublic(
  income: IIncome,
  extras?: { accountName?: string; categoryName?: string },
): IncomePublic {
  return {
    id: income._id.toString(),
    user: income.user.toString(),
    account: income.account.toString(),
    ...(extras?.accountName !== undefined ? { accountName: extras.accountName } : {}),
    amount: income.amount,
    currency: income.currency,
    description: income.description,
    category: income.category ? income.category.toString() : null,
    ...(extras?.categoryName !== undefined
      ? { categoryName: extras.categoryName }
      : {}),
    occurredAt: income.occurredAt.toISOString(),
    transactionId: income.transactionId.toString(),
    createdAt: income.createdAt.toISOString(),
    updatedAt: income.updatedAt.toISOString(),
  };
}

export const Income: Model<IIncome> =
  (mongoose.models.Income as Model<IIncome> | undefined) ??
  mongoose.model<IIncome>("Income", incomeSchema);
