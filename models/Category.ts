import mongoose, { Schema, type Document, type Model } from "mongoose";

export const CATEGORY_KINDS = ["expense", "income", "both"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export interface ICategory extends Document {
  name: string;
  nameNormalized: string;
  kind: CategoryKind;
  user: mongoose.Types.ObjectId | null;
  isPredefined: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    nameNormalized: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    kind: {
      type: String,
      required: true,
      enum: CATEGORY_KINDS,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    isPredefined: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Predefined: unique per (nameNormalized, kind) among predefined rows
categorySchema.index(
  { isPredefined: 1, nameNormalized: 1, kind: 1 },
  {
    unique: true,
    partialFilterExpression: { isPredefined: true },
  },
);

// Custom: unique per (user, nameNormalized, kind)
categorySchema.index(
  { user: 1, nameNormalized: 1, kind: 1 },
  {
    unique: true,
    partialFilterExpression: { isPredefined: false, user: { $type: "objectId" } },
  },
);

export interface CategoryPublic {
  id: string;
  name: string;
  kind: CategoryKind;
  isPredefined: boolean;
  user: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toCategoryPublic(category: ICategory): CategoryPublic {
  return {
    id: category._id.toString(),
    name: category.name,
    kind: category.kind,
    isPredefined: category.isPredefined,
    user: category.user ? category.user.toString() : null,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}

export const Category: Model<ICategory> =
  (mongoose.models.Category as Model<ICategory> | undefined) ??
  mongoose.model<ICategory>("Category", categorySchema);
