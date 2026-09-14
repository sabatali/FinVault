import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IExpense extends Document {
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

const expenseSchema = new Schema<IExpense>(
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

expenseSchema.index({ user: 1, occurredAt: -1 });
expenseSchema.index({ account: 1, occurredAt: -1 });
expenseSchema.index({ user: 1, category: 1, occurredAt: -1 });

export interface ExpensePublic {
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

export function toExpensePublic(
  expense: IExpense,
  extras?: { accountName?: string; categoryName?: string },
): ExpensePublic {
  return {
    id: expense._id.toString(),
    user: expense.user.toString(),
    account: expense.account.toString(),
    ...(extras?.accountName !== undefined ? { accountName: extras.accountName } : {}),
    amount: expense.amount,
    currency: expense.currency,
    description: expense.description,
    category: expense.category ? expense.category.toString() : null,
    ...(extras?.categoryName !== undefined
      ? { categoryName: extras.categoryName }
      : {}),
    occurredAt: expense.occurredAt.toISOString(),
    transactionId: expense.transactionId.toString(),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

export const Expense: Model<IExpense> =
  (mongoose.models.Expense as Model<IExpense> | undefined) ??
  mongoose.model<IExpense>("Expense", expenseSchema);
