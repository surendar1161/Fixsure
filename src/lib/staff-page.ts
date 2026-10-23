import { redirect } from "next/navigation";
import { connection } from "next/server";
import { hasStaffSession } from "@/lib/auth";

export async function requireStaffPage(path: string) {
  await connection();
  if (!(await hasStaffSession())) redirect(`/staff/sign-in?next=${encodeURIComponent(path)}`);
}
