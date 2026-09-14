import { connectDB } from "@/lib/db";
import {
  Category,
  normalizeCategoryName,
  type CategoryKind,
} from "@/models/Category";

const PREDEFINED: Array<{ name: string; kind: CategoryKind }> = [
  { name: "Uncategorized", kind: "both" },
  { name: "Food", kind: "expense" },
  { name: "Transport", kind: "expense" },
  { name: "Rent/Housing", kind: "expense" },
  { name: "Utilities", kind: "expense" },
  { name: "Health", kind: "expense" },
  { name: "Shopping", kind: "expense" },
  { name: "Entertainment", kind: "expense" },
  { name: "Education", kind: "expense" },
  { name: "Other", kind: "expense" },
  { name: "Salary", kind: "income" },
  { name: "Freelance", kind: "income" },
  { name: "Gift", kind: "income" },
  { name: "Refund", kind: "income" },
  { name: "Other", kind: "income" },
];

let seedPromise: Promise<void> | null = null;

export async function ensurePredefinedCategories(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      await connectDB();

      for (const item of PREDEFINED) {
        const nameNormalized = normalizeCategoryName(item.name);
        await Category.updateOne(
          {
            isPredefined: true,
            nameNormalized,
            kind: item.kind,
          },
          {
            $setOnInsert: {
              name: item.name,
              nameNormalized,
              kind: item.kind,
              user: null,
              isPredefined: true,
            },
          },
          { upsert: true },
        );
      }
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }

  await seedPromise;
}
