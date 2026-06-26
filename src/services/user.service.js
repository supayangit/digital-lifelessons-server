import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

function formatUserProfile(user, lessonCount, favoriteCount) {
  const { password, ...safeUser } = user;
  return {
    _id: safeUser._id,
    name: safeUser.name,
    email: safeUser.email,
    bio: safeUser.bio || null,
    image: safeUser.image || null,
    role: safeUser.role,
    isPremium: Boolean(safeUser.isPremium),
    premiumSince: safeUser.premiumSince || null,
    lessonsCount: lessonCount,
    favoritesCount: favoriteCount,
  };
}

export async function getUserProfile(userId) {
  const db = getDB();
  const oid = new ObjectId(userId);

  const [user, lessonCount, favoriteCount] = await Promise.all([
    db.collection("user").findOne({ _id: oid }),
    db.collection("lessons").countDocuments({ creatorId: oid }),
    db.collection("favorites").countDocuments({ userId: oid }),
  ]);

  if (!user) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }

  return formatUserProfile(user, lessonCount, favoriteCount);
}

export async function getUserById(userId) {
  if (!ObjectId.isValid(userId)) {
    const err = new Error("Invalid user ID.");
    err.statusCode = 400;
    throw err;
  }

  const db = getDB();
  const oid = new ObjectId(userId);

  const [user, lessonCount, favoriteCount] = await Promise.all([
    db.collection("user").findOne({ _id: oid }),
    db.collection("lessons").countDocuments({ creatorId: oid }),
    db.collection("favorites").countDocuments({ userId: oid }),
  ]);

  if (!user) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }

  return formatUserProfile(user, lessonCount, favoriteCount);
}

export async function updateUserProfile(userId, data) {
  const db = getDB();
  const oid = new ObjectId(userId);
  const result = await db.collection("user").findOneAndUpdate(
    { _id: oid },
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: "after" }
  );

  const updated = result?.value;
  if (!updated) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }

  const safeUser = { ...updated };
  delete safeUser.password;
  return safeUser;
}
