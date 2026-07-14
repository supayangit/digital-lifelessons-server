import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import getStripe from "../config/stripe.js";
import { PREMIUM_PRICE_BDT, PREMIUM_CURRENCY, PAYMENT_STATUS } from "../constants/index.js";

// functions
function normalizeUserIdentifier(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function buildUserFilter({ userId, userEmail }) {
  const filters = [];
  const normalizedUserId = normalizeUserIdentifier(userId);
  const normalizedEmail = normalizeUserIdentifier(userEmail)?.toLowerCase();

  if (normalizedUserId) {
    if (ObjectId.isValid(normalizedUserId)) {
      filters.push({ _id: new ObjectId(normalizedUserId) });
    }
    filters.push({ id: normalizedUserId });
    filters.push({ userId: normalizedUserId });
  }

  if (normalizedEmail) {
    filters.push({ email: normalizedEmail });
  }

  if (filters.length === 0) {
    return null;
  }

  return { $or: filters };
}

async function processStripeSession(session, db) {
  const userId = session.metadata?.userId;
  const userEmail = session.metadata?.userEmail || session.customer_details?.email;
  const userFilter = buildUserFilter({ userId, userEmail });

  if (!userFilter) {
    console.error(
      "[v0] No usable user identifier found in Stripe session metadata or customer details.",
      { userId, userEmail }
    );
    return { received: true, processed: false };
  }

  const user = await db.collection("user").findOne(userFilter);
  if (!user) {
    console.error("[v0] User not found for Stripe session:", userFilter);
    return { received: true, processed: false };
  }

  const existingPayment = await db
    .collection("payments")
    .findOne({ stripeSessionId: session.id });

  if (existingPayment) {
    console.log("[v0] Duplicate Stripe session skipped:", session.id);
    return { received: true, processed: true, alreadyProcessed: true };
  }

  await db.collection("user").updateOne(
    { _id: user._id },
    { $set: { isPremium: true, premiumSince: new Date(), updatedAt: new Date() } }
  );

  await db.collection("payments").insertOne({
    userId: user._id,
    email: userEmail,
    amount: session.amount_total,
    stripeSessionId: session.id,
    paymentIntentId: session.payment_intent || null,
    status: PAYMENT_STATUS.COMPLETED,
    createdAt: new Date(),
  });

  console.log(`[v0] User ${user._id.toString()} upgraded to premium.`);
  return { received: true, processed: true };
}

export async function createCheckoutSession(user) {
  const session = await getStripe().checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: PREMIUM_CURRENCY,
          unit_amount: PREMIUM_PRICE_BDT,
          product_data: {
            name: "Digital Life Lessons — Lifetime Premium",
            description:
              "Unlock all premium lessons, create premium content, and support the platform.",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user._id?.toString() || user.id,
      userEmail: user.email,
    },
    success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Handle Stripe webhook events.
 * Uses raw body to verify signature.
 */
export async function handleWebhook(rawBody, signature) {
  const db = getDB();

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[v0] Stripe webhook signature verification failed:", err.message);
    const error = new Error(`Webhook signature verification failed: ${err.message}`);
    error.statusCode = 400;
    throw error;
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    console.log("[v0] Stripe webhook event received:", event.type, "session", session.id);
    return await processStripeSession(session, db);
  }

  return { received: true, processed: false };
}

export async function confirmCheckoutSession(sessionId) {
  const db = getDB();
  const stripe = getStripe();

  if (!sessionId) {
    throw new Error("Missing Stripe session_id.");
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["customer_details"],
  });

  if (!session) {
    throw new Error("Stripe session not found.");
  }

  if (!["complete", "async_payment_succeeded"].includes(session.status)) {
    return {
      success: false,
      message: "Checkout session is not complete.",
      sessionStatus: session.status,
    };
  }

  return await processStripeSession(session, db);
}
