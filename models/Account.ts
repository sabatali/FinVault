import mongoose, { Schema, type Document, type Model } from "mongoose";

import {
  ACCOUNT_TYPES,
  type AccountPublic,
  type AccountType,
} from "@/lib/account-types";

export { ACCOUNT_TYPES, type AccountPublic, type AccountType };

export interface IAccount extends Document {
  owner: mongoose.Types.ObjectId;
  name: string;
  type: AccountType;
  currency: string;
  cachedBalance: number;
  openingBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    type: {
      type: String,
      required: true,
      enum: ACCOUNT_TYPES,
    },
    currency: {
      type: String,
      default: "PKR",
      uppercase: true,
      match: /^[A-Z]{3}$/,
    },
    cachedBalance: {
      type: Number,
      default: 0,
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

accountSchema.index({ owner: 1 });

export function toAccountPublic(account: IAccount): AccountPublic {
  return {
    id: account._id.toString(),
    owner: account.owner.toString(),
    name: account.name,
    type: account.type,
    currency: account.currency,
    cachedBalance: account.cachedBalance,
    openingBalance: account.openingBalance,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export const Account: Model<IAccount> =
  (mongoose.models.Account as Model<IAccount> | undefined) ??
  mongoose.model<IAccount>("Account", accountSchema);
