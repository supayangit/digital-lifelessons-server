import { getAuth } from "../auth/auth.js";
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

function buildUserRecord(sessionUser) {
  return {
    name: sessionUser.name || sessionUser.email?.split("@")[0] || "User",
    email: sessionUser.email || null,
    image: sessionUser.image || null,
    role: sessionUser.role || "user",
    isPremium: false,
    premiumSince: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function findOrCreateUser(db, sessionUser) {
  let user = null;
  let filter = null;

  if (sessionUser.id && ObjectId.isValid(sessionUser.id)) {
    filter = { _id: new ObjectId(sessionUser.id) };
    user = await db.collection("user").findOne(filter);
  }

  if (!user && sessionUser.email) {
    filter = { email: sessionUser.email };
    user = await db.collection("user").findOne(filter);
  }

  if (!user) {
    const record = buildUserRecord(sessionUser);
    if (sessionUser.id && ObjectId.isValid(sessionUser.id)) {
      record._id = new ObjectId(sessionUser.id);
    }

    const result = await db.collection("user").insertOne(record);
    user = await db.collection("user").findOne({ _id: result.insertedId });
  }

  return user;
}

/**
 * Verifies that a valid session exists and attaches user to req.user
 */
export async function verifySession(req, res, next) {
  try {
    // Debug: log incoming auth headers for troubleshooting cross-origin issues
    console.log('[debug] verifySession incoming', {
      method: req.method,
      url: req.originalUrl,
      authorization: req.headers.authorization || null,
      cookie: req.headers.cookie || null,
    });
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session || !session.user) {
      console.error("[v0] verifySession missing session/user", {
        authorization: req.headers.authorization,
        cookie: req.headers.cookie,
      });
      return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
    }

    const db = getDB();
    const user = await findOrCreateUser(db, session.user);

    if (!user) {
      console.error("[v0] verifySession user resolution failed", {
        sessionUser: session.user,
      });
      return res.status(401).json({ success: false, message: "User not found." });
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role || "user",
      isPremium: user.isPremium || false,
      premiumSince: user.premiumSince || null,
    };

    next();
  } catch (err) {
    console.error("[v0] verifySession error:", err.message, {
      authorization: req.headers.authorization,
      cookie: req.headers.cookie,
    });
    return res.status(401).json({ success: false, message: "Invalid or expired session." });
  }
}
