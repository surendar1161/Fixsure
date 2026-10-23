import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { StaffSignIn } from "@/components/Forms";
import { staffKeyConfigured } from "@/lib/auth";

export const metadata: Metadata = { title: "Staff sign-in" };

export default async function StaffSignInPage({ searchParams }: PageProps<"/staff/sign-in">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/review";
  return (
    <div className="wrap page">
      <section className="card signin">
        <div className="card-title">
          <h2>Staff desks</h2>
          <ShieldCheck size={20} className="faint" />
        </div>
        <p className="muted" style={{ marginBottom: 20 }}>
          The review and dispatch desks can release or return money, so they need the staff key.
        </p>
        {staffKeyConfigured() ? (
          <StaffSignIn next={target} />
        ) : (
          <div className="banner banner-warn" style={{ margin: 0 }}>
            Set FIXSURE_STAFF_KEY on the server to open the desks in production.
          </div>
        )}
      </section>
    </div>
  );
}
