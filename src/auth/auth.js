import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getDB } from "../config/db.js";


let authInstance;

export function createAuth() {
  if (authInstance) return authInstance;

  const db = getDB();

  authInstance = betterAuth({
    database: mongodbAdapter(db),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },

    advanced: {
      crossOrigin: true,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "none",
        secure: true, // MUST be true when sameSite="none" per browser security requirements
        path: "/",
      },
    },

    trustedOrigins: [process.env.CLIENT_URL].filter(Boolean),

    user: {
      additionalFields: {
        image: {
          type: "string",
          required: false,
        },
        role: {
          type: "string",
          defaultValue: "user",
          input: false,
        },
        isPremium: {
          type: "boolean",
          defaultValue: false,
          input: false,
        },
        premiumSince: {
          type: "date",
          required: false,
          input: false,
        },
      },
    },
  });

  return authInstance;
}

export function getAuth() {
  if (!authInstance) {
    throw new Error("Auth not initialized. Call createAuth() first.");
  }
  return authInstance;
}
