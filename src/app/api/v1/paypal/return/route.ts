import { NextResponse, type NextRequest } from "next/server";
import { roleForKey } from "@/lib/auth";
import { messageOf } from "@/lib/errors";
import { completePayPalApproval } from "@/lib/jobs";
import { links } from "@/lib/links";
import { getJob } from "@/lib/store";

/** PayPal sends the buyer here after approval. Always answers with a 303 to a page. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const key = params.get("k");
  const orderId = params.get("token");
  const job = await getJob(params.get("job") ?? "");

  if (!job || roleForKey(job, key) !== "customer") return NextResponse.redirect(new URL("/", request.url), 303);

  let target = links.customer(job);
  if (!orderId) {
    target = links.customer(job, { error: "PayPal did not return an order." });
  } else {
    try {
      await completePayPalApproval(job, orderId);
    } catch (error) {
      target = links.customer(job, { error: messageOf(error) });
    }
  }
  return NextResponse.redirect(new URL(target, request.url), 303);
}
