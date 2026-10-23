import { appUrl, paypalEnv } from "@/lib/config";
import { ApiError } from "@/lib/errors";

type PayPalLink = { href: string; rel: string };

type PayPalAuthorization = { id: string; status?: string; expiration_time?: string };

type PayPalOrder = {
  id: string;
  status?: string;
  links?: PayPalLink[];
  purchase_units?: {
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: {
      authorizations?: PayPalAuthorization[];
    };
  }[];
};

type PayPalCapture = { id: string; status?: string };

type PayPalPayoutBatch = {
  batch_header?: { payout_batch_id?: string; batch_status?: string };
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function baseUrl() {
  return paypalEnv() === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text.slice(0, 180) };
  }
}

function paypalMessage(payload: Record<string, unknown>, fallback: string) {
  const details = payload.details;
  if (Array.isArray(details) && details[0] && typeof details[0] === "object" && "description" in details[0]) {
    return String(details[0].description);
  }
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error_description === "string") return payload.error_description;
  return fallback;
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new ApiError("upstream", "PayPal is not configured.");

  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const payload = await readBody(response);
  if (!response.ok) throw new ApiError("upstream", paypalMessage(payload, "PayPal authentication failed."));

  const token = String(payload.access_token || "");
  const expiresIn = Number(payload.expires_in) || 300;
  if (!token) throw new ApiError("upstream", "PayPal did not return an access token.");
  cachedToken = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

// A fixed PayPal-Request-Id makes a retried capture, void, or payout return the
// first result instead of moving money a second time.
async function paypal<T>(path: string, method: "GET" | "POST", body?: unknown, requestId?: string): Promise<T> {
  const token = await accessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (requestId) headers["PayPal-Request-Id"] = requestId;

  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await readBody(response);
  if (!response.ok) throw new ApiError("upstream", paypalMessage(payload, `PayPal request failed (${response.status}).`));
  return payload as T;
}

export async function createAuthorizeOrder(input: {
  jobId: string;
  customerKey: string;
  amount: string;
  description: string;
}) {
  const key = encodeURIComponent(input.customerKey);
  const order = await paypal<PayPalOrder>(
    "/v2/checkout/orders",
    "POST",
    {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: input.jobId,
          custom_id: input.jobId,
          description: input.description.slice(0, 127),
          amount: { currency_code: "USD", value: input.amount },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Fixsure",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${appUrl()}/api/v1/paypal/return?job=${input.jobId}&k=${key}`,
            cancel_url: `${appUrl()}/jobs/${input.jobId}?k=${key}&paypal=cancelled`,
          },
        },
      },
    },
    `order-${input.jobId}`,
  );

  const link = order.links?.find((item) => item.rel === "payer-action") ?? order.links?.find((item) => item.rel === "approve");
  if (!order.id || !link) throw new ApiError("upstream", "PayPal did not return a checkout link.");
  return { id: order.id, approveUrl: link.href };
}

export async function getOrder(orderId: string) {
  const order = await paypal<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, "GET");
  const unit = order.purchase_units?.[0];
  return {
    status: order.status ?? "",
    customId: unit?.custom_id ?? "",
    currency: unit?.amount?.currency_code ?? "",
    amount: unit?.amount?.value ?? "",
    authorization: unit?.payments?.authorizations?.[0],
  };
}

export async function authorizeOrder(orderId: string) {
  const existing = await getOrder(orderId);
  if (existing.authorization?.id) {
    return { id: existing.authorization.id, expiresAt: existing.authorization.expiration_time };
  }

  const authorized = await paypal<PayPalOrder>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
    "POST",
    {},
    `authorize-${orderId}`,
  );
  const authorization = authorized.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!authorization?.id) throw new ApiError("upstream", "PayPal authorized the order without an authorization id.");
  return { id: authorization.id, expiresAt: authorization.expiration_time };
}

/**
 * Captures a whole authorization, or one slice of it. Milestone projects capture
 * each milestone as a partial capture and mark only the last one final.
 */
export async function captureAuthorization(
  authorizationId: string,
  part?: { key: string; amount: string; final: boolean; note: string },
) {
  const body = part
    ? {
        amount: { currency_code: "USD", value: part.amount },
        final_capture: part.final,
        invoice_id: part.key.slice(0, 127),
        note_to_payer: part.note.slice(0, 255),
      }
    : { final_capture: true };
  const capture = await paypal<PayPalCapture>(
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,
    "POST",
    body,
    part ? `capture-${part.key}` : `capture-${authorizationId}`,
  );
  if (!capture.id) throw new ApiError("upstream", "PayPal capture did not return an id.");
  return capture.id;
}

export async function voidAuthorization(authorizationId: string) {
  await paypal(
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`,
    "POST",
    undefined,
    `void-${authorizationId}`,
  );
}

export async function sendPayout(input: { jobId: string; itemId?: string; attempt: number; email: string; amount: string; note: string }) {
  const itemId = input.itemId ? `${input.jobId}-${input.itemId}` : input.jobId;
  const batchKey = `fixsure-${itemId}-${input.attempt}`;
  const batch = await paypal<PayPalPayoutBatch>(
    "/v1/payments/payouts",
    "POST",
    {
      sender_batch_header: {
        sender_batch_id: batchKey,
        email_subject: "You were paid for a repair",
        email_message: input.note,
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: input.email,
          amount: { value: input.amount, currency: "USD" },
          note: input.note,
          sender_item_id: itemId,
        },
      ],
    },
    `payout-${batchKey}`,
  );
  const batchId = batch.batch_header?.payout_batch_id;
  if (!batchId) throw new ApiError("upstream", "PayPal did not return a payout batch.");
  return batchId;
}
