import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap page" style={{ textAlign: "center", padding: "120px 0" }}>
      <h1 style={{ fontSize: 44 }}>Nothing here</h1>
      <p className="muted" style={{ margin: "12px auto 28px", maxWidth: 460 }}>
        This job does not exist, or the link is missing its key. Job links only work with the key they were sent with.
      </p>
      <Link href="/" className="btn btn-dark">
        Back home
      </Link>
    </div>
  );
}
