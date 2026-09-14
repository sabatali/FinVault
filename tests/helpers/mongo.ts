import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet | null = null;

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

/** Start a single-node replica set so multi-document transactions work. */
export async function startTestMongo(): Promise<string> {
  if (replSet) {
    return replSet.getUri();
  }

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  global.mongooseCache = { conn: null, promise: null };

  await mongoose.connect(uri, {
    bufferCommands: false,
    retryWrites: false,
  });
  global.mongooseCache = { conn: mongoose, promise: Promise.resolve(mongoose) };

  return uri;
}

export async function stopTestMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  global.mongooseCache = { conn: null, promise: null };

  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}

export async function clearTestMongo(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
}
