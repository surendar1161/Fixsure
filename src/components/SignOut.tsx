"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost"
      onClick={async () => {
        await fetch("/api/v1/session", { method: "DELETE" });
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut size={14} /> Sign out
    </button>
  );
}
