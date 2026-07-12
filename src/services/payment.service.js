import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import getStripe from "../config/stripe.js";
import { PREMIUM_PRICE_BDT, PREMIUM_CURRENCY, PAYMENT_STATUS } from "../constants/index.js";

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
      userId: user.id,
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

    // Idempotency check — prevent duplicate processing
    const existingPayment = await db
      .collection("payments")
      .findOne({ stripeSessionId: session.id });

    if (existingPayment) {
      console.log("[v0] Duplicate webhook event skipped for session:", session.id);
      return { received: true };
    }

    const userId = session.metadata?.userId;
    const userEmail = session.metadata?.userEmail || session.customer_details?.email;

    let userFilter = null;
    let userOid = null;

    if (userId) {
      try {
        userOid = new ObjectId(userId);
        userFilter = { _id: userOid };
      } catch (err) {
        console.warn("[v0] Invalid metadata userId in Stripe session:", userId);
      }
    }

    if (!userFilter && userEmail) {
      userFilter = { email: userEmail };
    }

    if (!userFilter) {
      console.error("[v0] No usable user identifier found in Stripe session metadata or customer details.");
      return { received: true };
    }

    const user = await db.collection("user").findOne(userFilter);
    if (!user) {
      console.error("[v0] User not found for Stripe session:", userFilter);
      return { received: true };
    }

    userOid = user._id;

    // Update user to premium
    await db.collection("user").updateOne(
      { _id: userOid },
      { $set: { isPremium: true, premiumSince: new Date(), updatedAt: new Date() } }
    );

    // Record payment
    await db.collection("payments").insertOne({
      userId: userOid,
      email: userEmail,
      amount: session.amount_total,
      stripeSessionId: session.id,
      paymentIntentId: session.payment_intent || null,
      status: PAYMENT_STATUS.COMPLETED,
      createdAt: new Date(),
    });

    console.log(`[v0] User ${user._id.toString()} upgraded to premium.`);
  }

  return { received: true };
}
