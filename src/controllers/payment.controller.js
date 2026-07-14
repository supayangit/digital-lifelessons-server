import * as PaymentService from "../services/payment.service.js";

export async function createCheckoutSession(req, res) {
  const result = await PaymentService.createCheckoutSession(req.user);
  res.json({ success: true, ...result });
}

export async function confirmCheckoutSession(req, res) {
  const sessionId = req.query.session_id || req.query.sessionId;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: "Missing session_id query parameter." });
  }

  try {
    const result = await PaymentService.confirmCheckoutSession(sessionId);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("[v0] confirmCheckoutSession error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to confirm checkout session." });
  }
}

export async function stripeWebhook(req, res) {
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({ success: false, message: "Missing stripe-signature header." });
  }

  // req.body here is the raw Buffer (set in app.js)
  const result = await PaymentService.handleWebhook(req.body, signature);
  res.json(result);
}
