"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function TopBar() {
  const dark = usePathname() === "/";
  return (
    <header className={`topbar${dark ? " dark" : ""}`}>
      <div className="wrap topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <ShieldCheck size={17} strokeWidth={2.4} />
          </span>
          Fixsure
        </Link>
        <nav className="nav">
          <Link href="/#kinds">How it works</Link>
          <Link href="/review">Review desk</Link>
          <Link href="/dispatch">Dispatch</Link>
          <Link href="/schedule">Schedule</Link>
          <Link href="/crew">Crew</Link>
          <Link href="/docs">API</Link>
          <Link href="/projects/new">Projects</Link>
          <Link href="/jobs/new" className={`btn btn-sm ${dark ? "btn-glass" : "btn-dark"}`}>
            Start a job
          </Link>
        </nav>
      </div>
    </header>
  );
}
