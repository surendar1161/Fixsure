export const RELEASE_CONFIDENCE = 0.82;

export function visionConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function paypalEnv(): "sandbox" | "live" {
  return process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
}

export function elasticConfigured() {
  return Boolean(process.env.ELASTIC_URL && process.env.ELASTIC_API_KEY);
}

export function zapierConfigured() {
  return Boolean(process.env.ZAPIER_HOOK_URL);
}

export function appUrl() {
  const url = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
  return url.replace(/\/$/, "");
}

export function platformFeePercent() {
  const value = Number(process.env.PLATFORM_FEE_PERCENT);
  return Number.isFinite(value) && value >= 0 && value < 50 ? value : 10;
}

export function splitPayment(priceUsd: number) {
  const feeUsd = Math.round(priceUsd * platformFeePercent()) / 100;
  return { feeUsd, payoutUsd: Math.round((priceUsd - feeUsd) * 100) / 100 };
}

/** Milestones above this amount always need a person, even when the model passes them. */
export function humanReviewAboveUsd() {
  const value = Number(process.env.MILESTONE_HUMAN_REVIEW_ABOVE_USD);
  return Number.isFinite(value) && value >= 0 ? value : 400;
}

export function openaiModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export function integrations() {
  return {
    vision: visionConfigured() ? "openai" : "fallback",
    paypal: paypalConfigured() ? paypalEnv() : "demo",
    elastic: elasticConfigured() ? "elastic" : "local",
    zapier: zapierConfigured() ? "connected" : "off",
  } as const;
}
