import { getAuth } from "../auth/auth.js";
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

/**
 * Optional authentication: attaches user if session exists, but doesn't require it.
 * Used for routes that should work for both authenticated and unauthenticated users.
 */
export async function optionalAuth(req, res, next) {
  try {
    const auth = getAuth();
    let session = await auth.api.getSession({ headers: req.headers });

    // Fallback: try cookie-simulated lookup when an Authorization bearer token
    // is provided but no cookie/session was found.
    if ((!session || !session.user) && req.headers.authorization) {
      try {
        const authHeader = String(req.headers.authorization || "");
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (token) {
          const fakeCookie = `__Secure-better-auth.session_token=${token}`;
          session = await auth.api.getSession({ headers: { cookie: fakeCookie, authorization: req.headers.authorization } });
        }
      } catch (e) {
        // ignore
      }
    }

    if (session && session.user) {
      // Fetch fresh user data from DB
      const db = getDB();
      const user = await db
        .collection("user")
        .findOne({ _id: new ObjectId(session.user.id) });

      if (user) {
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
      }
    }
  } catch (err) {
    // Silently ignore auth errors — just continue as unauthenticated
    console.debug("[optionalAuth] Auth check skipped:", err.message);
  }

  next();
}
