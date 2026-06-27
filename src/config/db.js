import { MongoClient } from "mongodb";

let client;
let db;

export async function connectDB() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME;

  if (!uri) throw new Error("MONGODB_URI is not defined in environment variables");
  if (!dbName) throw new Error("DB_NAME is not defined in environment variables");

  client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  db = client.db(dbName);

  // Create indexes for performance
  await createIndexes(db);

  console.log(`[v0] Connected to MongoDB: ${dbName}`);
  return db;
}

export function getDB() {
  if (!db) throw new Error("Database not connected. Call connectDB() first.");
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
    db = null;
    client = null;
    console.log("[v0] MongoDB connection closed.");
  }
}

async function createIndexes(db) {
  // users
  await db.collection("user").createIndex({ email: 1 }, { unique: true });
  await db.collection("user").createIndex({ role: 1 });

  // lessons
  await db.collection("lessons").createIndex({ creatorId: 1 });
  await db.collection("lessons").createIndex({ category: 1 });
  await db.collection("lessons").createIndex({ visibility: 1 });
  await db.collection("lessons").createIndex({ featured: 1 });
  await db.collection("lessons").createIndex({ createdAt: -1 });
  await db.collection("lessons").createIndex({ title: "text", description: "text" });

  // favorites
  await db.collection("favorites").createIndex({ userId: 1, lessonId: 1 }, { unique: true });

  // likes
  await db.collection("likes").createIndex({ userId: 1, lessonId: 1 }, { unique: true });

  // comments
  await db.collection("comments").createIndex({ lessonId: 1 });

  // lessonReports
  await db.collection("lessonReports").createIndex({ lessonId: 1 });
  await db.collection("lessonReports").createIndex({ reporterId: 1, lessonId: 1 }, { unique: true });

  // payments
  await db.collection("payments").createIndex({ stripeSessionId: 1 }, { unique: true });
  await db.collection("payments").createIndex({ userId: 1 });
}
